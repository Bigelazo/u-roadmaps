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
import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeEditorHandle, NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';
import type {
  NewRoadmapNode,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
  RoadmapNodeTypeInput,
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

/** The persistence operations the session binds to its input as plain mutations. */
type BoundOperation = Exclude<
  keyof RoadmapCanvasSessionPersistence,
  'load' | 'complete' | 'loadSimulation' | 'addNode' | 'completeSimulatedNode' | 'resetSimulation'
>;
type OperationArgs<K extends BoundOperation> =
  Parameters<RoadmapCanvasSessionPersistence[K]> extends [RoadmapCanvasSessionInput, ...infer Args]
    ? Args
    : never;
type OperationResult<K extends BoundOperation> = Awaited<
  ReturnType<RoadmapCanvasSessionPersistence[K]>
>;

type InjectedSessionResult = {
  roadmap: AnyRoadmapDto | null;
  simulationRoadmap: StudentRoadmapDto | null;
  error: string | null;
  dismissError: () => void;
  retryRefresh: () => void;
  accessLost: boolean;
  isClosed: boolean;
  loadSimulation: () => Promise<boolean>;
  persistence: RoadmapCanvasSessionPersistence;
  /** The session input without the fields only the view reads, so its identity stays stable. */
  stableInput: RoadmapCanvasSessionInput;
  /** Runs a write, reloads the Roadmap and reports a failure as the session error. */
  mutate: <T>(
    operation: () => Promise<T>,
    fallback: string,
    reload?: boolean,
  ) => Promise<{ success: boolean; result: T | undefined }>;
  /** Runs a read whose failure is reported as the session error; resolves `null` then. */
  preview: <T>(operation: () => Promise<T>, fallback: string) => Promise<T | null>;
  addNode: (
    node: NewRoadmapNode,
    position: Point,
    onCreated?: (nodeId: string) => void,
  ) => Promise<boolean>;
  updateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  moveNode: (nodeId: string, position: Point) => Promise<boolean>;
  scheduleTeacherUnlock: (nodeId: string, unlockOn: string | null) => Promise<boolean>;
  addResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  uploadResource: (nodeId: string, file: File) => Promise<boolean>;
  updateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  deleteResource: (resourceId: string) => Promise<boolean>;
  addNodeType: (nodeType: RoadmapNodeTypeInput) => Promise<boolean>;
  updateNodeType: (nodeTypeId: string, nodeType: RoadmapNodeTypeInput) => Promise<boolean>;
  completeNode: (nodeId: string) => Promise<boolean>;
  completeSimulatedNode: (nodeId: string) => Promise<boolean>;
};

type RoadmapCanvasSessionWorkflows = {
  canvasPreviewWorkflow: ReturnType<typeof useCanvasPreviewWorkflow>;
  canvasCommands: ReturnType<typeof useCanvasCommands>;
};

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
): InjectedSessionResult {
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
            message: messageFor(cause, 'No se pudo actualizar el roadmap. Puedes reintentar.'),
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
          message: messageFor(cause, 'No se pudo actualizar el roadmap. Puedes reintentar.'),
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

  const mutate = useCallback(
    async <T,>(operation: () => Promise<T>, fallback: string, reload = true) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const result = await operation();
        if (reload) await refresh();
        if (activeKeyRef.current !== requestKey) return { success: false, result };
        setError(null);
        return { success: true, result };
      } catch (cause) {
        await reportFailure(cause, fallback, requestKey);
        return { success: false, result: undefined };
      }
    },
    [refresh, reportFailure, stableInput],
  );

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

  const addNode = useCallback(
    async (node: NewRoadmapNode, position: Point, onCreated?: (nodeId: string) => void) => {
      const result = await mutate(
        () => persistence.addNode(stableInput, node, position),
        'No se pudo crear el nodo.',
      );
      if (result.success && typeof result.result === 'string') onCreated?.(result.result);
      return result.success;
    },
    [mutate, persistence, stableInput],
  );

  const operations = useMemo(() => {
    const run = <K extends BoundOperation>(name: K, args: OperationArgs<K>) =>
      (
        persistence[name] as (
          input: RoadmapCanvasSessionInput,
          ...args: unknown[]
        ) => Promise<OperationResult<K>>
      ).call(persistence, stableInput, ...args);
    const bindMutation =
      <K extends BoundOperation>(name: K, fallback: string) =>
      async (...args: OperationArgs<K>) =>
        (await mutate(() => run(name, args), fallback)).success;
    return {
      updateNode: bindMutation('updateNode', 'No se pudo guardar el nodo.'),
      moveNode: bindMutation('moveNode', 'No se pudo guardar la posición.'),
      scheduleTeacherUnlock: bindMutation(
        'scheduleTeacherUnlock',
        'No se pudo programar el desbloqueo.',
      ),
      addResource: bindMutation('addResource', 'No se pudo agregar el recurso.'),
      uploadResource: bindMutation('uploadResource', 'No se pudo subir el archivo.'),
      updateResource: bindMutation('updateResource', 'No se pudo guardar el recurso.'),
      deleteResource: bindMutation('deleteResource', 'No se pudo eliminar el recurso.'),
      addNodeType: bindMutation('addNodeType', 'No se pudo crear el tipo de nodo.'),
      updateNodeType: bindMutation('updateNodeType', 'No se pudo guardar el tipo de nodo.'),
    };
  }, [mutate, persistence, stableInput]);

  const completeNode = useCallback(
    async (nodeId: string) =>
      (
        await mutate(
          () => persistence.complete(stableInput, nodeId),
          'No se pudo completar el nodo.',
        )
      ).success,
    [mutate, persistence, stableInput],
  );

  const completeSimulatedNode = useCallback(
    async (nodeId: string) => {
      const result = await mutate(
        () => persistence.completeSimulatedNode(stableInput, nodeId),
        'No se pudo completar el nodo en la previsualización.',
        false,
      );
      if (!result.success) return false;
      return loadSimulation();
    },
    [loadSimulation, mutate, persistence, stableInput],
  );

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
    stableInput,
    mutate,
    preview,
    addNode,
    ...operations,
    completeNode,
    completeSimulatedNode,
  };
}

export function useRoadmapCanvasSession(
  input: RoadmapCanvasSessionInput,
  options: RoadmapCanvasSessionOptions = {},
): InjectedSessionResult & RoadmapCanvasSessionWorkflows {
  const persistence = useContext(persistenceContext);
  const active = useInjectedSession(input, persistence);
  const guardDraft = options.guardDraft ?? allowAnyDraft;
  const canvasPreviewWorkflow = useCanvasPreviewWorkflow({
    currentView: options.canvasPreview?.currentView ?? initialCanvasPreviewView,
    isHistorical: active.isClosed,
    guardDraft: () => guardDraft({ kind: 'enter-canvas-preview' }),
    loadSimulation: active.loadSimulation,
    completeSimulatedNode: active.completeSimulatedNode,
    onEnter: options.canvasPreview?.onEnter ?? noop,
    onExit: options.canvasPreview?.onExit ?? noop,
  });
  const { roadmap: canonicalRoadmap, loadSimulation: reloadPreview } = active;
  useEffect(() => {
    if (canvasPreviewWorkflow.isActive && canonicalRoadmap) void reloadPreview();
  }, [canonicalRoadmap, reloadPreview, canvasPreviewWorkflow.isActive]);
  const canvasCommands = useCanvasCommands({
    session: active,
    guardDraft,
    onCommandApplied: options.onCommandApplied ?? noop,
  });

  return {
    ...active,
    canvasPreviewWorkflow,
    canvasCommands,
  };
}
