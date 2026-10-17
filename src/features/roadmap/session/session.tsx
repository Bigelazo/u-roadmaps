'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useCanvasPreviewWorkflow } from '@/features/roadmap/canvas/canvas-preview-workflow';
import { useCanvasCommands } from '@/features/roadmap/canvas/commands/use-canvas-commands';
import { httpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';
import type { AnyRoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import {
  subscribeToRoadmapChanges,
  subscribeToRoadmapRecovery,
} from '@/features/roadmap/session/change-signal';

import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';

const persistenceContext = createContext<RoadmapCanvasSessionPersistence>(
  httpRoadmapCanvasSessionPersistence,
);

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

const refreshFailure = 'No se pudo actualizar el roadmap. Puedes reintentar.';

type CanvasPreviewView = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
};

export type RoadmapCanvasSessionOptions = {
  guardDraft?: NodeEditorHandle['guardDraft'];
  onCommandApplied?: Parameters<typeof useCanvasCommands>[0]['onCommandApplied'];
  canvasPreview?: {
    currentView: CanvasPreviewView;
    onEnter: () => void;
    onExit: (returnState: CanvasPreviewView) => void;
  };
};

const allowAnyDraft = async () => true;
const noop = () => undefined;
const initialCanvasPreviewView: CanvasPreviewView = {
  selectedNodeId: null,
  isEditorOpen: false,
  isStudentDetailOpen: false,
};

export function RoadmapCanvasSessionPersistenceProvider({
  persistence,
  children,
}: {
  persistence: RoadmapCanvasSessionPersistence;
  children: ReactNode;
}) {
  return <persistenceContext.Provider value={persistence}>{children}</persistenceContext.Provider>;
}

function useInjectedSession(
  input: RoadmapCanvasSessionInput,
  persistence: RoadmapCanvasSessionPersistence,
) {
  const [roadmap, setRoadmap] = useState<AnyRoadmapDto | null>(null);
  const [simulationRoadmap, setSimulationRoadmap] = useState<StudentRoadmapDto | null>(null);
  const [roadmapKey, setRoadmapKey] = useState<string | null>(null);
  const [simulationKey, setSimulationKey] = useState<string | null>(null);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  // The message belongs to the session key it was raised for, so it hides after a key change.
  const [error, setError] = useState<{ message: string; key: string } | null>(null);
  const key = roadmapCanvasSessionKey(input);
  const activeKeyRef = useRef(key);
  const requestVersionRef = useRef(0);
  const simulationVersionRef = useRef(0);
  const courseCode = input.courseOffering.identifier.courseCode;
  const year = input.courseOffering.identifier.year;
  const semester = input.courseOffering.identifier.semester;
  const title = input.courseOffering.title;
  const experienceKind = input.experience.kind;
  const experienceTerm = input.experience.term;
  // Persistence only sees the Course offering and experience. The other input fields
  // (notifications, entry key, target Node, practice callbacks) are read by the view, and
  // leaving them out keeps every operation's identity stable while they change.
  const stableInput = useMemo<RoadmapCanvasSessionInput>(
    () => ({
      courseOffering: {
        identifier: { courseCode, year, semester },
        title,
      },
      experience: { kind: experienceKind, term: experienceTerm },
    }),
    [courseCode, experienceKind, experienceTerm, semester, title, year],
  );

  const refresh = useCallback(
    async (applyProjection = true) => {
      const requestVersion = ++requestVersionRef.current;
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const loadedRoadmap = await persistence.load(stableInput);
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== requestKey) {
          return false;
        }
        if (applyProjection) {
          setRoadmap(loadedRoadmap);
          setRoadmapKey(requestKey);
        }
        return true;
      } catch (cause) {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== requestKey) {
          return false;
        }
        if (cause instanceof RoadmapAccessLostError) {
          setRoadmap(null);
          setSimulationRoadmap(null);
          setAccessLost(true);
        }
        throw cause;
      }
    },
    [persistence, stableInput],
  );

  useEffect(() => {
    if (experienceTerm !== 'current') return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = 1000;
    const recover = () => {
      clearTimeout(retry);
      void refresh(experienceKind === 'teaching').then(
        (loaded) => {
          if (loaded && active) {
            retryDelay = 1000;
            setError(null);
          }
        },
        (cause: unknown) => {
          if (!active || activeKeyRef.current !== key) return;
          if (!(cause instanceof RoadmapAccessLostError)) {
            retry = setTimeout(recover, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30_000);
          }
          setError({
            message: messageFor(cause, refreshFailure),
            key,
          });
        },
      );
    };
    const stopChanges = subscribeToRoadmapChanges((changedOffering) => {
      if (
        changedOffering.courseCode !== courseCode ||
        changedOffering.year !== year ||
        changedOffering.semester !== semester
      )
        return;
      if (experienceKind === 'teaching' || changedOffering.accessLost) recover();
    });
    const stopRecovery = subscribeToRoadmapRecovery(() => {
      if (experienceKind === 'teaching') recover();
    });
    return () => {
      active = false;
      clearTimeout(retry);
      stopChanges();
      stopRecovery();
    };
  }, [courseCode, experienceKind, experienceTerm, key, refresh, semester, year]);

  useEffect(() => {
    activeKeyRef.current = key;
    setAccessLost(false);
    const requestVersion = ++requestVersionRef.current;
    const simulationVersion = ++simulationVersionRef.current;
    setRoadmap(null);
    setSimulationRoadmap(null);
    setRoadmapKey(null);
    setSimulationKey(null);
    setError(null);
    void persistence.load(stableInput).then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        setRoadmap(loadedRoadmap);
        setRoadmapKey(key);
      },
      (cause: unknown) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        if (cause instanceof RoadmapAccessLostError) {
          setRoadmap(null);
          setAccessLost(true);
        }
        setError({ message: messageFor(cause, 'No se pudo cargar el roadmap.'), key });
      },
    );
    return () => {
      activeKeyRef.current = '';
      requestVersionRef.current += 1;
      simulationVersionRef.current = Math.max(simulationVersionRef.current, simulationVersion + 1);
    };
  }, [key, persistence, stableInput]);

  const retryRefresh = useCallback(() => {
    void refresh().then(
      (loaded) => {
        if (!loaded) return;
        setError(null);
      },
      (cause: unknown) => {
        if (activeKeyRef.current !== key) return;
        setError({
          message: messageFor(cause, refreshFailure),
          key,
        });
      },
    );
  }, [key, refresh]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const reportFailure = useCallback(
    async (cause: unknown, fallback: string, requestKey: string) => {
      if (activeKeyRef.current !== requestKey) return;
      if (cause instanceof RoadmapClosedError) {
        setClosedKey(requestKey);
        // Keep the refusal visible even if the recovery read fails.
        await refresh().catch(() => false);
      }
      // Recovery may finish after the participant changes Course offering.
      if (activeKeyRef.current !== requestKey) return;
      setError({ message: messageFor(cause, fallback), key: requestKey });
    },
    [refresh],
  );

  /**
   * Runs a write, then reloads the Roadmap; a failed write is the session error. The write
   * took effect once it resolves: a failed reload is shown as the session error but does
   * not undo it.
   */
  const mutate = useCallback(
    async <T,>(operation: () => Promise<T>, fallback: string, reload = true) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      let result: T;
      try {
        result = await operation();
      } catch (cause) {
        await reportFailure(cause, fallback, requestKey);
        return { success: false, result: undefined };
      }
      try {
        if (reload) await refresh();
        if (activeKeyRef.current === requestKey) setError(null);
      } catch (cause) {
        if (activeKeyRef.current === requestKey) {
          setError({ message: messageFor(cause, refreshFailure), key: requestKey });
        }
      }
      return { success: activeKeyRef.current === requestKey, result };
    },
    [refresh, reportFailure, stableInput],
  );

  /** Runs a read whose failure is reported as the session error; resolves `null` then. */
  const preview = useCallback(
    async <T,>(operation: () => Promise<T>, fallback: string) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const result = await operation();
        return activeKeyRef.current === requestKey ? result : null;
      } catch (cause) {
        await reportFailure(cause, fallback, requestKey);
        return null;
      }
    },
    [reportFailure, stableInput],
  );

  const loadSimulation = useCallback(async () => {
    const requestKey = roadmapCanvasSessionKey(stableInput);
    const requestVersion = ++simulationVersionRef.current;
    try {
      const loadedSimulation = await persistence.loadSimulation(stableInput);
      if (requestVersion !== simulationVersionRef.current || activeKeyRef.current !== requestKey) {
        return false;
      }
      setSimulationRoadmap(loadedSimulation);
      setSimulationKey(requestKey);
      setError(null);
      return true;
    } catch (cause) {
      if (activeKeyRef.current === requestKey) {
        setError({
          message: messageFor(cause, 'No se pudo cargar la previsualización.'),
          key: requestKey,
        });
      }
      return false;
    }
  }, [persistence, stableInput]);

  return {
    roadmap: roadmapKey === key ? roadmap : null,
    simulationRoadmap: simulationKey === key ? simulationRoadmap : null,
    error: error?.key === key ? error.message : null,
    dismissError,
    retryRefresh,
    accessLost,
    isClosed:
      input.experience.term === 'historical' ||
      closedKey === key ||
      (roadmapKey === key && Boolean(roadmap?.roadmap.closedAt)),
    loadSimulation,
    persistence,
    /** The session input without the fields only the view reads, so its identity stays stable. */
    stableInput,
    mutate,
    preview,
  };
}

export function useRoadmapCanvasSession(
  input: RoadmapCanvasSessionInput,
  options: RoadmapCanvasSessionOptions = {},
) {
  const persistence = useContext(persistenceContext);
  const active = useInjectedSession(input, persistence);
  const guardDraft = options.guardDraft ?? allowAnyDraft;
  const report = input.practice?.onAction;
  const canvasCommands = useCanvasCommands({
    session: active,
    guardDraft,
    onCommandApplied: options.onCommandApplied ?? noop,
    report,
  });
  const { perform } = canvasCommands;
  const completeSimulatedNode = useCallback(
    (nodeId: string) => perform({ kind: 'complete-simulated-node', nodeId }),
    [perform],
  );
  const prepareCanvasPreview = options.canvasPreview?.onEnter ?? noop;
  // Reported once per entry, although the Canvas preview reloads on every Roadmap change.
  const enterCanvasPreview = useCallback(() => {
    prepareCanvasPreview();
    report?.({ type: 'enterCanvasPreview' });
  }, [prepareCanvasPreview, report]);
  const canvasPreviewWorkflow = useCanvasPreviewWorkflow({
    currentView: options.canvasPreview?.currentView ?? initialCanvasPreviewView,
    isHistorical: active.isClosed,
    guardDraft: () => guardDraft({ kind: 'enter-canvas-preview' }),
    loadSimulation: active.loadSimulation,
    completeSimulatedNode,
    onEnter: enterCanvasPreview,
    onExit: options.canvasPreview?.onExit ?? noop,
  });
  const { roadmap: canonicalRoadmap, loadSimulation: reloadPreview } = active;
  useEffect(() => {
    if (canvasPreviewWorkflow.isActive && canonicalRoadmap) void reloadPreview();
  }, [canonicalRoadmap, reloadPreview, canvasPreviewWorkflow.isActive]);

  return {
    ...active,
    canvasPreviewWorkflow,
    canvasCommands,
  };
}
