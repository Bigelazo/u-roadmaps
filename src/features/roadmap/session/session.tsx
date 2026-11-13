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
import type { AnyRoadmapDto, Resource, StudentRoadmapDto } from '@/features/roadmap/types';
import { withAccessedResource } from '@/features/roadmap/domain/resource-review';
import type { NodeEditorHandle } from '@/features/roadmap/editor/types';
import type {
  ExecutionResult,
  ResourceAccessScope,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';
import {
  subscribeToRoadmapChanges,
  subscribeToRoadmapRecovery,
} from '@/features/roadmap/session/change-signal';

import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';

const persistenceContext = createContext<RoadmapCanvasSessionPersistence | null>(null);

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

const refreshFailure = 'No se pudo actualizar el roadmap.';
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
  accessLost: boolean;
  isClosed: boolean;
  loadCanvasPreview: () => Promise<boolean>;
  recordResourceAccess: (resource: Resource, scope: ResourceAccessScope) => void;
};

export type RoadmapCanvasSession = Omit<RoadmapCanvasSessionState, 'recordResourceAccess'> & {
  canvasPreviewWorkflow: ReturnType<typeof useCanvasPreviewWorkflow>;
  canvasCommands: CanvasCommands;
  accessResource: (resource: Resource) => void;
};

function useInjectedSession(
  input: RoadmapCanvasSessionInput,
  persistence: RoadmapCanvasSessionPersistence,
): { state: RoadmapCanvasSessionState; commandSession: CanvasCommandSession } {
  const [roadmap, setRoadmap] = useState<AnyRoadmapDto | null>(null);
  const [canvasPreviewRoadmap, setCanvasPreviewRoadmap] = useState<StudentRoadmapDto | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionAliveRef = useRef(true);
  const requestVersionRef = useRef(0);
  const canvasPreviewVersionRef = useRef(0);
  const courseCode = input.courseOffering.identifier.courseCode;
  const year = input.courseOffering.identifier.year;
  const semester = input.courseOffering.identifier.semester;
  const experienceKind = input.experience.kind;
  const experienceTerm = input.experience.term;
  const loadRoadmap = useCallback(async () => {
    const loadedRoadmap = await persistence.load();
    if (!matchesExperience(loadedRoadmap, experienceKind)) {
      throw new Error(loadFailure);
    }
    return loadedRoadmap;
  }, [experienceKind, persistence]);

  const refresh = useCallback(
    async (applyProjection = true) => {
      const requestVersion = ++requestVersionRef.current;
      try {
        const loadedRoadmap = await loadRoadmap();
        if (requestVersion !== requestVersionRef.current) {
          return false;
        }
        if (applyProjection) {
          setRoadmap(loadedRoadmap);
        }
        return true;
      } catch (cause) {
        if (requestVersion !== requestVersionRef.current) {
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
    [loadRoadmap],
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
          if (!active) return;
          if (!(cause instanceof RoadmapAccessLostError)) {
            retry = setTimeout(recover, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30_000);
          }
          setError(messageFor(cause, refreshFailure));
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
  }, [courseCode, experienceKind, experienceTerm, refresh, semester, year]);

  useEffect(() => {
    sessionAliveRef.current = true;
    const requestVersion = ++requestVersionRef.current;
    void loadRoadmap().then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current) return;
        setRoadmap(loadedRoadmap);
      },
      (cause: unknown) => {
        if (requestVersion !== requestVersionRef.current) return;
        if (cause instanceof RoadmapAccessLostError) {
          setRoadmap(null);
          setAccessLost(true);
        }
        setError(messageFor(cause, loadFailure));
      },
    );
    return () => {
      sessionAliveRef.current = false;
    };
  }, [loadRoadmap]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const reportFailure = useCallback(
    async (cause: unknown) => {
      const sessionEndedBeforeFailureRefresh = !sessionAliveRef.current;
      if (sessionEndedBeforeFailureRefresh) return;
      if (cause instanceof RoadmapClosedError) {
        setIsClosed(true);
        await refresh().catch(() => false);
      }
      setError(messageFor(cause, genericFailure));
    },
    [refresh],
  );

  const loadCanvasPreview = useCallback(async () => {
    const requestVersion = ++canvasPreviewVersionRef.current;
    try {
      const loadedCanvasPreview = await persistence.loadCanvasPreview();
      if (requestVersion !== canvasPreviewVersionRef.current) {
        return false;
      }
      setCanvasPreviewRoadmap(loadedCanvasPreview);
      setError(null);
      return true;
    } catch (cause) {
      setError(messageFor(cause, genericFailure));
      return false;
    }
  }, [persistence]);

  const recordResourceAccess = useCallback(
    (resource: Resource, scope: ResourceAccessScope) => {
      void persistence.recordResourceAccess(resource, scope).then(
        ({ countsAccess }) => {
          const markAccessed = <Roadmap extends AnyRoadmapDto>(current: Roadmap | null) =>
            current ? withAccessedResource(current, resource.id, countsAccess) : current;
          if (scope === 'canvas-preview') setCanvasPreviewRoadmap(markAccessed);
          else setRoadmap(markAccessed);
        },
        () => undefined,
      );
    },
    [persistence],
  );

  const readChangeImpact = useCallback<CanvasCommandSession['readChangeImpact']>(
    async (command) => {
      try {
        const impact = await persistence.readChangeImpact(command);
        const sessionEndedBeforeImpactCouldWrite = !sessionAliveRef.current;
        return sessionEndedBeforeImpactCouldWrite ? null : impact;
      } catch (cause) {
        await reportFailure(cause);
        return null;
      }
    },
    [persistence, reportFailure],
  );

  const execute = useCallback<CanvasCommandSession['execute']>(
    async (command, previewVersion) => {
      let result: ExecutionResult | void;
      try {
        result = await persistence.execute(command, previewVersion);
      } catch (cause) {
        await reportFailure(cause);
        return { applied: false };
      }
      const { changesCanvasPreview } = canvasCommandCatalog[command.kind];
      try {
        if (!changesCanvasPreview) await refresh();
        setError(null);
      } catch (cause) {
        setError(messageFor(cause, refreshFailure));
      }
      const sessionAliveToAnnounceAppliedCommand = sessionAliveRef.current;
      const applied = sessionAliveToAnnounceAppliedCommand;
      if (applied && changesCanvasPreview) await loadCanvasPreview();
      return { applied, ...result };
    },
    [loadCanvasPreview, persistence, refresh, reportFailure],
  );

  const commandSession = useMemo(
    () => ({ readChangeImpact, execute }),
    [execute, readChangeImpact],
  );

  return {
    state: {
      roadmap,
      canvasPreviewRoadmap,
      error,
      dismissError,
      accessLost,
      isClosed:
        input.experience.term === 'historical' || isClosed || Boolean(roadmap?.roadmap.closedAt),
      loadCanvasPreview,
      recordResourceAccess,
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
  const {
    roadmap: canonicalRoadmap,
    loadCanvasPreview: reloadPreview,
    recordResourceAccess,
    isClosed,
    ...state
  } = active;
  useEffect(() => {
    if (canvasPreviewWorkflow.isActive && canonicalRoadmap) void reloadPreview();
  }, [canonicalRoadmap, reloadPreview, canvasPreviewWorkflow.isActive]);
  const isCanvasPreview = canvasPreviewWorkflow.isActive;
  const accessResource = useCallback(
    (resource: Resource) => {
      if (isClosed) return;
      if (isCanvasPreview) recordResourceAccess(resource, 'canvas-preview');
      else if (input.experience.kind === 'student') recordResourceAccess(resource, 'roadmap');
    },
    [input.experience.kind, isCanvasPreview, isClosed, recordResourceAccess],
  );

  return {
    ...state,
    roadmap: canonicalRoadmap,
    loadCanvasPreview: reloadPreview,
    isClosed,
    canvasPreviewWorkflow,
    canvasCommands,
    accessResource,
  };
}
