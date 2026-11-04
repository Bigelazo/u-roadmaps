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
import { canvasCommandCatalog } from '@/features/roadmap/canvas/commands/commands';
import {
  useCanvasCommands,
  type CanvasCommands,
  type CanvasCommandSession,
} from '@/features/roadmap/canvas/commands/use-canvas-commands';
import { createHttpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';
import type { AnyRoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  ExecutionResult,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';
import {
  subscribeToRoadmapChanges,
  subscribeToRoadmapRecovery,
} from '@/features/roadmap/session/change-signal';

import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';

const persistenceContext = createContext<RoadmapCanvasSessionPersistence | null>(null);

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

const refreshFailure = 'No se pudo actualizar el roadmap. Puedes reintentar.';
/** For a failure that carries no message at all; the adapters always give one. */
const genericFailure = 'No se pudo completar la acción.';
const loadFailure = 'No se pudo cargar el roadmap.';

function matchesExperience(
  roadmap: AnyRoadmapDto,
  experience: RoadmapCanvasSessionInput['experience']['kind'],
) {
  return roadmap.nodes.every((node) =>
    experience === 'teaching' ? 'isTeacherBlocked' in node : 'access' in node,
  );
}

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

type RoadmapCanvasSessionState = {
  roadmap: AnyRoadmapDto | null;
  canvasPreviewRoadmap: StudentRoadmapDto | null;
  error: string | null;
  dismissError: () => void;
  retryRefresh: () => void;
  accessLost: boolean;
  isClosed: boolean;
  loadCanvasPreview: () => Promise<boolean>;
};

export type RoadmapCanvasSession = RoadmapCanvasSessionState & {
  canvasPreviewWorkflow: ReturnType<typeof useCanvasPreviewWorkflow>;
  canvasCommands: CanvasCommands;
};

function useInjectedSession(
  input: RoadmapCanvasSessionInput,
  persistence: RoadmapCanvasSessionPersistence,
): { state: RoadmapCanvasSessionState; commandSession: CanvasCommandSession } {
  const [roadmap, setRoadmap] = useState<AnyRoadmapDto | null>(null);
  const [canvasPreviewRoadmap, setCanvasPreviewRoadmap] = useState<StudentRoadmapDto | null>(null);
  const [roadmapKey, setRoadmapKey] = useState<string | null>(null);
  const [canvasPreviewKey, setCanvasPreviewKey] = useState<string | null>(null);
  const [closedKey, setClosedKey] = useState<string | null>(null);
  const [accessLost, setAccessLost] = useState(false);
  const [error, setError] = useState<{ message: string; key: string } | null>(null);
  const key = roadmapCanvasSessionKey(input);
  const activeKeyRef = useRef(key);
  const requestVersionRef = useRef(0);
  const canvasPreviewVersionRef = useRef(0);
  const courseCode = input.courseOffering.identifier.courseCode;
  const year = input.courseOffering.identifier.year;
  const semester = input.courseOffering.identifier.semester;
  const title = input.courseOffering.title;
  const experienceKind = input.experience.kind;
  const experienceTerm = input.experience.term;
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

  const loadRoadmap = useCallback(async () => {
    const loadedRoadmap = await persistence.load();
    if (!matchesExperience(loadedRoadmap, stableInput.experience.kind)) {
      throw new Error(loadFailure);
    }
    return loadedRoadmap;
  }, [persistence, stableInput]);

  const refresh = useCallback(
    async (applyProjection = true) => {
      const requestVersion = ++requestVersionRef.current;
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const loadedRoadmap = await loadRoadmap();
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
          setCanvasPreviewRoadmap(null);
          setAccessLost(true);
        }
        throw cause;
      }
    },
    [loadRoadmap, stableInput],
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
    const canvasPreviewVersion = ++canvasPreviewVersionRef.current;
    setRoadmap(null);
    setCanvasPreviewRoadmap(null);
    setRoadmapKey(null);
    setCanvasPreviewKey(null);
    setError(null);
    void loadRoadmap().then(
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
        setError({ message: messageFor(cause, loadFailure), key });
      },
    );
    return () => {
      activeKeyRef.current = '';
      requestVersionRef.current += 1;
      canvasPreviewVersionRef.current = Math.max(
        canvasPreviewVersionRef.current,
        canvasPreviewVersion + 1,
      );
    };
  }, [key, loadRoadmap]);

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
    async (cause: unknown, requestKey: string) => {
      if (activeKeyRef.current !== requestKey) return;
      if (cause instanceof RoadmapClosedError) {
        setClosedKey(requestKey);
        await refresh().catch(() => false);
      }
      if (activeKeyRef.current !== requestKey) return;
      setError({ message: messageFor(cause, genericFailure), key: requestKey });
    },
    [refresh],
  );

  const loadCanvasPreview = useCallback(async () => {
    const requestKey = roadmapCanvasSessionKey(stableInput);
    const requestVersion = ++canvasPreviewVersionRef.current;
    try {
      const loadedCanvasPreview = await persistence.loadCanvasPreview();
      if (
        requestVersion !== canvasPreviewVersionRef.current ||
        activeKeyRef.current !== requestKey
      ) {
        return false;
      }
      setCanvasPreviewRoadmap(loadedCanvasPreview);
      setCanvasPreviewKey(requestKey);
      setError(null);
      return true;
    } catch (cause) {
      if (activeKeyRef.current === requestKey) {
        setError({ message: messageFor(cause, genericFailure), key: requestKey });
      }
      return false;
    }
  }, [persistence, stableInput]);

  const readChangeImpact = useCallback<CanvasCommandSession['readChangeImpact']>(
    async (command) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const impact = await persistence.readChangeImpact(command);
        return activeKeyRef.current === requestKey ? impact : null;
      } catch (cause) {
        await reportFailure(cause, requestKey);
        return null;
      }
    },
    [persistence, reportFailure, stableInput],
  );

  const execute = useCallback<CanvasCommandSession['execute']>(
    async (command, previewVersion) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      let result: ExecutionResult | void;
      try {
        result = await persistence.execute(command, previewVersion);
      } catch (cause) {
        await reportFailure(cause, requestKey);
        return { applied: false };
      }
      const { changesCanvasPreview } = canvasCommandCatalog[command.kind];
      try {
        if (!changesCanvasPreview) await refresh();
        if (activeKeyRef.current === requestKey) setError(null);
      } catch (cause) {
        if (activeKeyRef.current === requestKey) {
          setError({ message: messageFor(cause, refreshFailure), key: requestKey });
        }
      }
      const applied = activeKeyRef.current === requestKey;
      if (applied && changesCanvasPreview) await loadCanvasPreview();
      return { applied, ...result };
    },
    [loadCanvasPreview, persistence, refresh, reportFailure, stableInput],
  );

  const commandSession = useMemo(
    () => ({ readChangeImpact, execute }),
    [execute, readChangeImpact],
  );

  return {
    state: {
      roadmap: roadmapKey === key ? roadmap : null,
      canvasPreviewRoadmap: canvasPreviewKey === key ? canvasPreviewRoadmap : null,
      error: error?.key === key ? error.message : null,
      dismissError,
      retryRefresh,
      accessLost,
      isClosed:
        input.experience.term === 'historical' ||
        closedKey === key ||
        (roadmapKey === key && Boolean(roadmap?.roadmap.closedAt)),
      loadCanvasPreview,
    },
    commandSession,
  };
}

export function useRoadmapCanvasSession(
  input: RoadmapCanvasSessionInput,
  options: RoadmapCanvasSessionOptions = {},
): RoadmapCanvasSession {
  const providedPersistence = useContext(persistenceContext);
  const { courseCode, year, semester } = input.courseOffering.identifier;
  const persistence = useMemo(
    () =>
      providedPersistence ??
      createHttpRoadmapCanvasSessionPersistence({ courseCode, year, semester }),
    [courseCode, providedPersistence, semester, year],
  );
  const { state: active, commandSession } = useInjectedSession(input, persistence);
  const guardDraft = options.guardDraft ?? allowAnyDraft;
  const report = input.practice?.onAction;
  const canvasCommands = useCanvasCommands({
    session: commandSession,
    guardDraft,
    onCommandApplied: options.onCommandApplied ?? noop,
    report,
  });
  const { request } = canvasCommands;
  const completeCanvasPreviewNode = useCallback(
    (nodeId: string) => request({ kind: 'complete-canvas-preview-node', nodeId }),
    [request],
  );
  const prepareCanvasPreview = options.canvasPreview?.onEnter ?? noop;
  const enterCanvasPreview = useCallback(() => {
    prepareCanvasPreview();
    report?.({ type: 'enterCanvasPreview' });
  }, [prepareCanvasPreview, report]);
  const canvasPreviewWorkflow = useCanvasPreviewWorkflow({
    currentView: options.canvasPreview?.currentView ?? initialCanvasPreviewView,
    isHistorical: active.isClosed,
    guardDraft: () => guardDraft({ kind: 'enter-canvas-preview' }),
    loadCanvasPreview: active.loadCanvasPreview,
    completeCanvasPreviewNode,
    onEnter: enterCanvasPreview,
    onExit: options.canvasPreview?.onExit ?? noop,
  });
  const { roadmap: canonicalRoadmap, loadCanvasPreview: reloadPreview } = active;
  useEffect(() => {
    if (canvasPreviewWorkflow.isActive && canonicalRoadmap) void reloadPreview();
  }, [canonicalRoadmap, reloadPreview, canvasPreviewWorkflow.isActive]);

  return {
    ...active,
    canvasPreviewWorkflow,
    canvasCommands,
  };
}
