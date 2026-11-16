'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Dispatch,
} from 'react';
import type { CanvasState, CanvasStateAction } from '@/features/roadmap/canvas/state';
import { useCanvasPreviewWorkflow } from '@/features/roadmap/canvas/canvas-preview-workflow';
import {
  canvasCommandCatalog,
  type AnyCommandEntry,
} from '@/features/roadmap/canvas/commands/commands';
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
const OWN_ECHO_WINDOW_MS = 2000;

type OwnEcho = { executing: number; heard: number; missed: boolean; expectedUntil: number };

function settleOwnCommand(echo: OwnEcho, counted: boolean) {
  if (!counted) return false;
  echo.executing -= 1;
  if (echo.executing > 0) return false;
  const { missed } = echo;
  echo.missed = false;
  return missed;
}

function absorbsOwnEcho(echo: OwnEcho) {
  echo.heard += 1;
  if (echo.executing > 0) {
    echo.missed = true;
    return true;
  }
  if (Date.now() > echo.expectedUntil) return false;
  echo.expectedUntil = 0;
  return true;
}
const claimedEntryRoadmaps = new WeakSet<Promise<AnyRoadmapDto | null>>();

function entryRoadmapForThisMount(entryRoadmap: Promise<AnyRoadmapDto | null> | undefined) {
  if (!entryRoadmap || claimedEntryRoadmaps.has(entryRoadmap)) return undefined;
  queueMicrotask(() => claimedEntryRoadmaps.add(entryRoadmap));
  return entryRoadmap;
}

async function settledEntryRoadmap(streamedThenable: PromiseLike<AnyRoadmapDto | null>) {
  try {
    return await streamedThenable;
  } catch {
    return null;
  }
}

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

export type RoadmapCanvasSessionOptions = {
  canvas: { state: CanvasState; dispatch: Dispatch<CanvasStateAction> };
  guardDraft?: NodeEditorHandle['guardDraft'];
  onCommandApplied?: Parameters<typeof useCanvasCommands>[0]['onCommandApplied'];
};

const allowAnyDraft = async () => true;
const noop = () => undefined;
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
  const ownEchoRef = useRef<OwnEcho>({ executing: 0, heard: 0, missed: false, expectedUntil: 0 });
  const latestLoadRef = useRef<{ startedAt: number; succeeded: Promise<boolean> } | null>(null);
  const courseCode = input.courseOffering.identifier.courseCode;
  const year = input.courseOffering.identifier.year;
  const semester = input.courseOffering.identifier.semester;
  const experienceKind = input.experience.kind;
  const experienceTerm = input.experience.term;
  const entryRoadmap = input.entryRoadmap;
  const loadRoadmap = useCallback(
    async (signal?: AbortSignal, readBeforeEntry?: Promise<AnyRoadmapDto | null>) => {
      const loadNow = () => persistence.load(signal);
      const loading = readBeforeEntry
        ? settledEntryRoadmap(readBeforeEntry).then((entered) => entered ?? loadNow())
        : loadNow();
      latestLoadRef.current = {
        startedAt: readBeforeEntry ? 0 : Date.now(),
        succeeded: loading.then(
          () => true,
          () => false,
        ),
      };
      const loadedRoadmap = await loading;
      if (!matchesExperience(loadedRoadmap, experienceKind)) {
        throw new Error(loadFailure);
      }
      return loadedRoadmap;
    },
    [experienceKind, persistence],
  );

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
      if (changedOffering.accessLost) recover();
      else if (experienceKind === 'teaching' && !absorbsOwnEcho(ownEchoRef.current)) recover();
    });
    const stopRecovery = subscribeToRoadmapRecovery((coveredSince) => {
      if (experienceKind !== 'teaching') return;
      const latestLoad = latestLoadRef.current;
      if (coveredSince === undefined || !latestLoad || latestLoad.startedAt < coveredSince) {
        recover();
        return;
      }
      void latestLoad.succeeded.then((succeeded) => {
        if (!succeeded && active) recover();
      });
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
    const entry = new AbortController();
    void loadRoadmap(entry.signal, entryRoadmapForThisMount(entryRoadmap)).then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current) return;
        setRoadmap(loadedRoadmap);
      },
      (cause: unknown) => {
        if (entry.signal.aborted || requestVersion !== requestVersionRef.current) return;
        if (cause instanceof RoadmapAccessLostError) {
          setRoadmap(null);
          setAccessLost(true);
        }
        setError(messageFor(cause, loadFailure));
      },
    );
    return () => {
      entry.abort();
      sessionAliveRef.current = false;
      canvasPreviewVersionRef.current += 1;
    };
  }, [entryRoadmap, loadRoadmap]);

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
      const entry: AnyCommandEntry = canvasCommandCatalog[command.kind];
      const { changesCanvasPreview } = entry;
      const echo = ownEchoRef.current;
      const heard = echo.heard;
      if (!changesCanvasPreview) echo.executing += 1;
      let result: ExecutionResult | void;
      try {
        result = await persistence.execute(command, previewVersion);
      } catch (cause) {
        const missed = settleOwnCommand(echo, !changesCanvasPreview);
        await reportFailure(cause);
        if (missed && sessionAliveRef.current) void refresh().catch(() => false);
        return { applied: false };
      }
      if (!changesCanvasPreview) {
        settleOwnCommand(echo, true);
        if (echo.heard === heard) echo.expectedUntil = Date.now() + OWN_ECHO_WINDOW_MS;
      }
      const refreshed = () =>
        refresh().then(
          () => {
            if (sessionAliveRef.current) setError(null);
          },
          (cause: unknown) => {
            if (sessionAliveRef.current) setError(messageFor(cause, refreshFailure));
          },
        );
      const update = entry.shownBeforeRefresh?.(command, result ?? {});
      if (changesCanvasPreview) setError(null);
      else if (update && sessionAliveRef.current) {
        setRoadmap((current) => (current ? update(current) : current));
        void refreshed();
      } else await refreshed();
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
  options: RoadmapCanvasSessionOptions,
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
  const enterCanvasPreview = useCallback(() => {
    report?.({ type: 'enterCanvasPreview' });
  }, [report]);
  const canvasPreviewWorkflow = useCanvasPreviewWorkflow({
    canvas: options.canvas,
    isHistorical: active.isClosed,
    guardDraft: () => guardDraft({ kind: 'enter-canvas-preview' }),
    loadCanvasPreview: active.loadCanvasPreview,
    completeCanvasPreviewNode,
    onEnter: enterCanvasPreview,
  });
  const {
    roadmap: canonicalRoadmap,
    loadCanvasPreview: reloadPreview,
    recordResourceAccess,
    isClosed,
    ...state
  } = active;
  const refreshActivePreview = useEffectEvent(() => {
    if (canvasPreviewWorkflow.isActive) void reloadPreview();
  });
  useEffect(() => {
    if (canonicalRoadmap) refreshActivePreview();
  }, [canonicalRoadmap, reloadPreview]);
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
