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
import type {
  CanvasCommand,
  RoadmapNodePlacement,
} from '@/features/roadmap/canvas/commands/canvas-command';
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
import {
  UncertainNodeCreationError,
  uncertainCreationMessage,
  type PlacementRecovery,
} from './placement-recovery';

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
const genericFailure = 'No se pudo completar la acción.';
const loadFailure = 'No se pudo cargar el roadmap.';

function unsynchronizedPlacement(failure: string) {
  return `${failure} No se pudo sincronizar el canvas con el roadmap guardado.`;
}

type PlacementCommand = Extract<
  CanvasCommand,
  { kind: 'move-nodes' | 'apply-automatic-layout' | 'add-node' }
>;
type PlacementOutcome = Awaited<ReturnType<CanvasCommandSession['execute']>>;
type PendingPlacement = {
  command: PlacementCommand;
  previewVersion?: string;
  resolve: (outcome: PlacementOutcome) => void;
};

function isPlacement(command: CanvasCommand): command is PlacementCommand {
  return (
    command.kind === 'move-nodes' ||
    command.kind === 'apply-automatic-layout' ||
    command.kind === 'add-node'
  );
}

function placementPositions(command: PlacementCommand): readonly RoadmapNodePlacement[] {
  if (command.kind === 'add-node') return command.displaced;
  if (command.kind === 'apply-automatic-layout') return command.layouts[command.direction ?? 'TB'];
  return command.positions;
}

function projectPlacements(roadmap: AnyRoadmapDto, pending: readonly PendingPlacement[]) {
  const positions = new Map<string, RoadmapNodePlacement['position']>();
  for (const { command } of pending)
    for (const { nodeId, position } of placementPositions(command)) positions.set(nodeId, position);
  if (!positions.size) return roadmap;
  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, positionX: position.x, positionY: position.y } : node;
    }),
  } as AnyRoadmapDto;
}

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
  placementRecovery: PlacementRecovery | null;
  recoverPlacement: () => Promise<boolean>;
  isActive: () => boolean;
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
  const [placementRecovery, setPlacementRecovery] = useState<PlacementRecovery | null>(null);
  const sessionAliveRef = useRef(true);
  const isActive = useCallback(() => sessionAliveRef.current, []);
  const authoritativeRoadmapRef = useRef<AnyRoadmapDto | null>(null);
  const uncertainCreationRef = useRef<Extract<PlacementCommand, { kind: 'add-node' }> | null>(null);
  const placementFailureRef = useRef<string | null>(null);
  const placementsRef = useRef<{ pending: PendingPlacement[]; running: boolean; blocked: boolean }>(
    { pending: [], running: false, blocked: false },
  );
  const requestVersionRef = useRef(0);
  const canvasPreviewVersionRef = useRef(0);
  const ownEchoRef = useRef<OwnEcho>({ executing: 0, heard: 0, missed: false, expectedUntil: 0 });
  const latestLoadRef = useRef<{ startedAt: number; succeeded: Promise<boolean> } | null>(null);
  const courseCode = input.courseOffering.identifier.courseCode;
  const year = input.courseOffering.identifier.year;
  const semester = input.courseOffering.identifier.semester;
  const experienceKind = input.experience.kind;
  const experienceTerm = input.experience.term;
  const loadRoadmap = useCallback(async () => {
    const loading = persistence.load();
    latestLoadRef.current = {
      startedAt: Date.now(),
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
  }, [experienceKind, persistence]);

  const refresh = useCallback(
    async (applyProjection = true) => {
      const requestVersion = ++requestVersionRef.current;
      try {
        const loadedRoadmap = await loadRoadmap();
        if (!sessionAliveRef.current || requestVersion !== requestVersionRef.current) {
          return false;
        }
        if (applyProjection) {
          authoritativeRoadmapRef.current = loadedRoadmap;
          setRoadmap(projectPlacements(loadedRoadmap, placementsRef.current.pending));
          const uncertain = uncertainCreationRef.current;
          if (uncertain) {
            const found = loadedRoadmap.nodes.some((node) => node.id === uncertain.nodeId);
            placementsRef.current.blocked = true;
            setPlacementRecovery({
              kind: found ? 'recovered-creation' : 'uncertain-creation',
              message: found
                ? 'El nodo está guardado. Continúa para finalizar esta creación.'
                : uncertainCreationMessage,
            });
          } else if (placementsRef.current.blocked) {
            placementsRef.current.blocked = false;
            setPlacementRecovery(null);
            setError(placementFailureRef.current);
          }
        }
        return true;
      } catch (cause) {
        if (!sessionAliveRef.current || requestVersion !== requestVersionRef.current) {
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
            setError(placementFailureRef.current);
          }
        },
        (cause: unknown) => {
          if (!active) return;
          if (!(cause instanceof RoadmapAccessLostError)) {
            retry = setTimeout(recover, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30_000);
          }
          setError(
            placementsRef.current.blocked
              ? unsynchronizedPlacement(placementFailureRef.current ?? genericFailure)
              : messageFor(cause, refreshFailure),
          );
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
    const placements = placementsRef.current;
    const requestVersion = ++requestVersionRef.current;
    void loadRoadmap().then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current) return;
        authoritativeRoadmapRef.current = loadedRoadmap;
        setRoadmap(projectPlacements(loadedRoadmap, placementsRef.current.pending));
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
      requestVersionRef.current += 1;
      canvasPreviewVersionRef.current += 1;
      const discarded = placements.pending;
      placements.pending = [];
      for (const pending of discarded) pending.resolve({ applied: false });
    };
  }, [loadRoadmap]);

  const dismissError = useCallback(() => {
    if (placementsRef.current.blocked) return;
    placementFailureRef.current = null;
    setError(null);
  }, []);

  const reportFailure = useCallback(
    async (cause: unknown, placement = false) => {
      const sessionEndedBeforeFailureRefresh = !sessionAliveRef.current;
      if (sessionEndedBeforeFailureRefresh) return;
      if (cause instanceof RoadmapClosedError) setIsClosed(true);
      if (placement) {
        placementFailureRef.current = messageFor(cause, genericFailure);
        setPlacementRecovery({
          kind: 'unsynchronized',
          message: `${placementFailureRef.current} Sincronizando el canvas con el roadmap guardado…`,
        });
      }
      if (placement || cause instanceof RoadmapClosedError) {
        try {
          const recovered = await refresh();
          if (placement && recovered) placementsRef.current.blocked = false;
        } catch {
          if (sessionAliveRef.current) {
            const message = unsynchronizedPlacement(messageFor(cause, genericFailure));
            setPlacementRecovery({ kind: 'unsynchronized', message });
            setError(message);
          }
          return;
        }
      }
      if (sessionAliveRef.current) setError(messageFor(cause, genericFailure));
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

  const executeCommand = useCallback(
    async (
      command: CanvasCommand,
      previewVersion?: string,
      placement?: PendingPlacement,
    ): Promise<PlacementOutcome> => {
      const entry: AnyCommandEntry = canvasCommandCatalog[command.kind];
      const { changesCanvasPreview } = entry;
      const echo = ownEchoRef.current;
      const heard = echo.heard;
      if (!changesCanvasPreview) echo.executing += 1;
      let result: ExecutionResult | void;
      try {
        const recoveredCreation =
          command.kind === 'add-node' &&
          uncertainCreationRef.current?.nodeId === command.nodeId &&
          authoritativeRoadmapRef.current?.nodes.some((node) => node.id === command.nodeId);
        result = recoveredCreation
          ? { createdNodeId: command.nodeId }
          : await persistence.execute(command, previewVersion);
        if (placement) {
          placementsRef.current.pending = placementsRef.current.pending.filter(
            (pending) => pending !== placement,
          );
          placementFailureRef.current = null;
          if (command.kind === 'add-node') uncertainCreationRef.current = null;
          placementsRef.current.blocked = false;
          if (sessionAliveRef.current) setPlacementRecovery(null);
        }
      } catch (cause) {
        if (placement) {
          const placements = placementsRef.current;
          placements.blocked = true;
          const discarded = placements.pending;
          placements.pending = [];
          for (const pending of discarded)
            if (pending !== placement) pending.resolve({ applied: false });
        }
        const missed = settleOwnCommand(echo, !changesCanvasPreview);
        if (
          command.kind === 'add-node' &&
          (cause instanceof UncertainNodeCreationError ||
            uncertainCreationRef.current?.nodeId === command.nodeId)
        ) {
          if (!sessionAliveRef.current) return { applied: false, sessionEnded: true };
          uncertainCreationRef.current = command;
          placementFailureRef.current = uncertainCreationMessage;
          setPlacementRecovery({ kind: 'uncertain-creation', message: uncertainCreationMessage });
          const recovered = await refresh().catch(() => false);
          if (
            recovered &&
            sessionAliveRef.current &&
            authoritativeRoadmapRef.current?.nodes.some((node) => node.id === command.nodeId)
          ) {
            uncertainCreationRef.current = null;
            placementsRef.current.blocked = false;
            placementFailureRef.current = null;
            setPlacementRecovery(null);
            setError(null);
            return { applied: true, createdNodeId: command.nodeId };
          }
          if (sessionAliveRef.current) setError(uncertainCreationMessage);
          return sessionAliveRef.current
            ? { applied: false, creationUncertain: true }
            : { applied: false, sessionEnded: true };
        }
        const failedPlacement = isPlacement(command);
        await reportFailure(cause, failedPlacement);
        if (missed && !failedPlacement && sessionAliveRef.current)
          void refresh().catch(() => false);
        return sessionAliveRef.current
          ? { applied: false }
          : { applied: false, sessionEnded: true };
      }
      if (!changesCanvasPreview) {
        settleOwnCommand(echo, true);
        if (echo.heard === heard) echo.expectedUntil = Date.now() + OWN_ECHO_WINDOW_MS;
      }
      if (!sessionAliveRef.current) return { applied: false, sessionEnded: true };
      const refreshed = () =>
        refresh().then(
          () => {
            if (
              sessionAliveRef.current &&
              !placementFailureRef.current &&
              !placementsRef.current.blocked
            )
              setError(null);
          },
          (cause: unknown) => {
            if (sessionAliveRef.current) {
              setError(messageFor(cause, refreshFailure));
              if (placement) {
                placementsRef.current.blocked = true;
                const discarded = placementsRef.current.pending;
                placementsRef.current.pending = [];
                for (const pending of discarded) pending.resolve({ applied: false });
                setPlacementRecovery({
                  kind: 'unsynchronized',
                  message: unsynchronizedPlacement(refreshFailure),
                });
              }
            }
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
      return { applied, ...result, ...(applied ? {} : { sessionEnded: true }) };
    },
    [loadCanvasPreview, persistence, refresh, reportFailure],
  );

  const execute = useCallback<CanvasCommandSession['execute']>(
    (command, previewVersion) => {
      if (!sessionAliveRef.current) return Promise.resolve({ applied: false, sessionEnded: true });
      if (!isPlacement(command)) return executeCommand(command, previewVersion);
      const retained = uncertainCreationRef.current;
      const resending = command.kind === 'add-node' && retained?.nodeId === command.nodeId;
      if (placementsRef.current.blocked && !resending) return Promise.resolve({ applied: false });
      return new Promise<PlacementOutcome>((resolve) => {
        const placements = placementsRef.current;
        placements.pending.push({
          command: resending ? retained : command,
          previewVersion,
          resolve,
        });
        setRoadmap((current) =>
          current ? projectPlacements(current, placements.pending) : current,
        );
        if (placements.running) return;
        placements.running = true;
        void (async () => {
          while (placements.pending.length) {
            const placement = placements.pending[0];
            placement.resolve(
              await executeCommand(placement.command, placement.previewVersion, placement),
            );
          }
          placements.running = false;
        })();
      });
    },
    [executeCommand],
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
      placementRecovery,
      recoverPlacement: () => refresh().catch(() => false),
      isActive,
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
