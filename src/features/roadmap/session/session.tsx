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
import { useRoadmap } from '@/features/roadmap/useRoadmap';
import {
  useRoadmapDependencyWorkflow,
  type RoadmapDependencyWorkflow,
} from '@/features/roadmap/session/dependency-workflow';
import { useRoadmapCanvasFeedback } from '@/features/roadmap/session/feedback';
import { httpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';
import type {
  AnyRoadmapDto,
  NodeDeletionImpact,
  StudentRoadmapDto,
  TeacherBlockImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';
import type {
  NewRoadmapNode,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
  RoadmapNodeTypeInput,
} from '@/features/roadmap/session/types';
import { roadmapCanvasSessionKey } from '@/features/roadmap/session/key';

const persistenceContext = createContext<RoadmapCanvasSessionPersistence | null>(null);

function messageFor(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}

function missingOperation(name: string): never {
  throw new Error(`La operación de sesión ${name} no está disponible.`);
}

type InjectedSessionResult = {
  roadmap: AnyRoadmapDto | null;
  simulationRoadmap: StudentRoadmapDto | null;
  error: string | null;
  dismissError: () => void;
  loadSimulation: () => Promise<boolean>;
  addNode: (
    node: NewRoadmapNode,
    position: Point,
    onCreated?: (nodeId: string) => void,
  ) => Promise<boolean>;
  updateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  moveNode: (nodeId: string, position: Point) => Promise<boolean>;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ) => Promise<boolean>;
  previewRoadmapDependency: (
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ) => Promise<TeacherBlockImpact[] | null>;
  previewTeacherBlock: (
    nodeId: string,
    operation: TeacherBlockOperation,
  ) => Promise<TeacherBlockPreview | null>;
  changeTeacherBlock: (
    nodeId: string,
    operation: TeacherBlockOperation,
    previewVersion?: string,
  ) => Promise<boolean>;
  deleteDependency: (dependencyId: string) => Promise<boolean>;
  toggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  previewNodeVisibility: (
    nodeId: string,
  ) => Promise<{ id: string; sourceNodeId: string; targetNodeId: string }[] | null>;
  previewNodeDeletion: (nodeId: string) => Promise<NodeDeletionImpact | null>;
  deleteNode: (nodeId: string, previewVersion?: string) => Promise<boolean>;
  addResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  uploadResource: (nodeId: string, file: File) => Promise<boolean>;
  updateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  deleteResource: (resourceId: string) => Promise<boolean>;
  addNodeType: (nodeType: RoadmapNodeTypeInput) => Promise<boolean>;
  updateNodeType: (nodeTypeId: string, nodeType: RoadmapNodeTypeInput) => Promise<boolean>;
  deleteNodeType: (nodeTypeId: string) => Promise<boolean>;
  completeNode: (nodeId: string) => Promise<boolean>;
  completeSimulatedNode: (nodeId: string) => Promise<boolean>;
  resetSimulation: () => Promise<boolean>;
  dependencyWorkflow: RoadmapDependencyWorkflow;
};

type PersistenceSnapshot = RoadmapCanvasSessionPersistence & {
  initialRoadmap?: AnyRoadmapDto;
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
  persistence: RoadmapCanvasSessionPersistence | null,
): InjectedSessionResult {
  const feedback = useRoadmapCanvasFeedback();
  const initialRoadmap = (persistence as PersistenceSnapshot | null)?.initialRoadmap ?? null;
  const initialRoadmapKey = initialRoadmap ? roadmapCanvasSessionKey(input) : null;
  const [roadmap, setRoadmap] = useState<AnyRoadmapDto | null>(initialRoadmap);
  const [simulationRoadmap, setSimulationRoadmap] = useState<StudentRoadmapDto | null>(null);
  const [roadmapKey, setRoadmapKey] = useState<string | null>(initialRoadmapKey);
  const [simulationKey, setSimulationKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const activeKeyRef = useRef(roadmapCanvasSessionKey(input));
  const requestVersionRef = useRef(0);
  const simulationVersionRef = useRef(0);
  const key = roadmapCanvasSessionKey(input);
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

  const refresh = useCallback(async () => {
    if (!persistence) return false;
    const requestVersion = ++requestVersionRef.current;
    const requestKey = roadmapCanvasSessionKey(stableInput);
    const loadedRoadmap = await persistence.load(stableInput);
    if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== requestKey) {
      return false;
    }
    setRoadmap(loadedRoadmap);
    setRoadmapKey(requestKey);
    return true;
  }, [persistence, stableInput]);

  useEffect(() => {
    if (!persistence) return;
    activeKeyRef.current = key;
    const requestVersion = ++requestVersionRef.current;
    const simulationVersion = ++simulationVersionRef.current;
    if (initialRoadmapKey !== key) setRoadmap(null);
    setSimulationRoadmap(null);
    if (initialRoadmapKey !== key) setRoadmapKey(null);
    setSimulationKey(null);
    setError(null);
    setErrorKey(null);
    void persistence.load(stableInput).then(
      (loadedRoadmap) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        setRoadmap(loadedRoadmap);
        setRoadmapKey(key);
      },
      (cause: unknown) => {
        if (requestVersion !== requestVersionRef.current || activeKeyRef.current !== key) return;
        setError(messageFor(cause, 'No se pudo cargar el roadmap.'));
        setErrorKey(key);
      },
    );
    return () => {
      requestVersionRef.current += 1;
      simulationVersionRef.current = Math.max(simulationVersionRef.current, simulationVersion + 1);
    };
  }, [initialRoadmapKey, key, persistence, stableInput]);

  const dismissError = useCallback(() => {
    setError(null);
    setErrorKey(null);
  }, []);

  const mutate = useCallback(
    async <T,>(operation: () => Promise<T>, fallback: string, reload = true) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const result = await operation();
        if (reload) await refresh();
        if (activeKeyRef.current !== requestKey) return { success: false, result };
        if (activeKeyRef.current === requestKey) {
          setError(null);
          setErrorKey(null);
        }
        return { success: true, result };
      } catch (cause) {
        if (activeKeyRef.current === requestKey) {
          setError(messageFor(cause, fallback));
          setErrorKey(requestKey);
        }
        return { success: false, result: undefined };
      }
    },
    [refresh, stableInput],
  );

  const preview = useCallback(
    async <T,>(operation: () => Promise<T>, fallback: string) => {
      const requestKey = roadmapCanvasSessionKey(stableInput);
      try {
        const result = await operation();
        return activeKeyRef.current === requestKey ? result : null;
      } catch (cause) {
        if (activeKeyRef.current === requestKey) {
          setError(messageFor(cause, fallback));
          setErrorKey(requestKey);
        }
        return null;
      }
    },
    [stableInput],
  );

  const loadSimulation = useCallback(async () => {
    if (!persistence?.loadSimulation) return missingOperation('cargar previsualización');
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
      setErrorKey(null);
      return true;
    } catch (cause) {
      if (activeKeyRef.current === requestKey) {
        setError(messageFor(cause, 'No se pudo cargar la previsualización.'));
        setErrorKey(requestKey);
      }
      return false;
    }
  }, [persistence, stableInput]);

  const addNode = useCallback(
    async (node: NewRoadmapNode, position: Point, onCreated?: (nodeId: string) => void) => {
      if (!persistence?.addNode) return missingOperation('crear nodo');
      const result = await mutate(
        () => persistence.addNode!(stableInput, node, position),
        'No se pudo crear el nodo.',
      );
      if (result.success && typeof result.result === 'string') onCreated?.(result.result);
      return result.success;
    },
    [mutate, persistence, stableInput],
  );

  const updateNode = useCallback(
    async (nodeId: string, node: NodeUpdate) => {
      if (!persistence?.updateNode) return missingOperation('guardar nodo');
      return (
        await mutate(
          () => persistence.updateNode!(stableInput, nodeId, node),
          'No se pudo guardar el nodo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const moveNode = useCallback(
    async (nodeId: string, position: Point) => {
      if (!persistence?.moveNode) return missingOperation('mover nodo');
      return (
        await mutate(
          () => persistence.moveNode!(stableInput, nodeId, position),
          'No se pudo guardar la posición.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const connectNodes = useCallback(
    async (
      sourceNodeId: string,
      targetNodeId: string,
      sourceHandle?: string,
      targetHandle?: string,
    ) => {
      if (!persistence?.connectNodes) return missingOperation('crear dependencia');
      return (
        await mutate(
          () =>
            persistence.connectNodes!(
              stableInput,
              sourceNodeId,
              targetNodeId,
              sourceHandle,
              targetHandle,
            ),
          'No se pudo crear la dependencia.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const previewRoadmapDependency = useCallback(
    async (
      sourceNodeId: string,
      targetNodeId: string,
      sourceHandle?: string,
      targetHandle?: string,
    ) => {
      if (!persistence?.previewRoadmapDependency)
        return missingOperation('previsualizar dependencia');
      return preview(
        () =>
          persistence.previewRoadmapDependency!(
            stableInput,
            sourceNodeId,
            targetNodeId,
            sourceHandle,
            targetHandle,
          ),
        'No se pudo calcular el impacto de la dependencia.',
      );
    },
    [persistence, preview, stableInput],
  );

  const previewTeacherBlock = useCallback(
    async (nodeId: string, operation: TeacherBlockOperation) => {
      if (!persistence?.previewTeacherBlock)
        return missingOperation('previsualizar bloqueo docente');
      return preview(
        () => persistence.previewTeacherBlock!(stableInput, nodeId, operation),
        'No se pudo calcular el impacto del bloqueo docente.',
      );
    },
    [persistence, preview, stableInput],
  );

  const changeTeacherBlock = useCallback(
    async (nodeId: string, operation: TeacherBlockOperation, previewVersion?: string) => {
      if (!persistence?.changeTeacherBlock) return missingOperation('cambiar bloqueo docente');
      return (
        await mutate(
          () => persistence.changeTeacherBlock!(stableInput, nodeId, operation, previewVersion),
          'No se pudo cambiar el bloqueo docente.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const deleteDependency = useCallback(
    async (dependencyId: string) => {
      if (!persistence?.deleteDependency) return missingOperation('eliminar dependencia');
      return (
        await mutate(
          () => persistence.deleteDependency!(stableInput, dependencyId),
          'No se pudo eliminar la dependencia.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const toggleVisibility = useCallback(
    async (nodeId: string, isVisible: boolean) => {
      if (!persistence?.toggleVisibility) return missingOperation('cambiar visibilidad');
      return (
        await mutate(
          () => persistence.toggleVisibility!(stableInput, nodeId, isVisible),
          'No se pudo cambiar la visibilidad.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const previewNodeVisibility = useCallback(
    async (nodeId: string) => {
      if (!persistence?.previewNodeVisibility) return missingOperation('previsualizar visibilidad');
      return preview(
        () => persistence.previewNodeVisibility!(stableInput, nodeId),
        'No se pudo calcular el impacto de ocultar el nodo.',
      );
    },
    [persistence, preview, stableInput],
  );

  const previewNodeDeletion = useCallback(
    async (nodeId: string) => {
      if (!persistence?.previewNodeDeletion) return missingOperation('previsualizar eliminación');
      return preview(
        () => persistence.previewNodeDeletion!(stableInput, nodeId),
        'No se pudo calcular el impacto de eliminar el nodo.',
      );
    },
    [persistence, preview, stableInput],
  );

  const deleteNode = useCallback(
    async (nodeId: string, previewVersion?: string) => {
      if (!persistence?.deleteNode) return missingOperation('eliminar nodo');
      return (
        await mutate(
          () => persistence.deleteNode!(stableInput, nodeId, previewVersion),
          'No se pudo eliminar el nodo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const addResource = useCallback(
    async (nodeId: string, resource: ResourceInput) => {
      if (!persistence?.addResource) return missingOperation('agregar recurso');
      return (
        await mutate(
          () => persistence.addResource!(stableInput, nodeId, resource),
          'No se pudo agregar el recurso.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const uploadResource = useCallback(
    async (nodeId: string, file: File) => {
      if (!persistence?.uploadResource) return missingOperation('subir archivo');
      return (
        await mutate(
          () => persistence.uploadResource!(stableInput, nodeId, file),
          'No se pudo subir el archivo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const updateResource = useCallback(
    async (resourceId: string, resource: ResourceInput) => {
      if (!persistence?.updateResource) return missingOperation('guardar recurso');
      return (
        await mutate(
          () => persistence.updateResource!(stableInput, resourceId, resource),
          'No se pudo guardar el recurso.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const deleteResource = useCallback(
    async (resourceId: string) => {
      if (!persistence?.deleteResource) return missingOperation('eliminar recurso');
      return (
        await mutate(
          () => persistence.deleteResource!(stableInput, resourceId),
          'No se pudo eliminar el recurso.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const addNodeType = useCallback(
    async (nodeType: RoadmapNodeTypeInput) => {
      if (!persistence?.addNodeType) return missingOperation('crear tipo de nodo');
      return (
        await mutate(
          () => persistence.addNodeType!(stableInput, nodeType),
          'No se pudo crear el tipo de nodo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const updateNodeType = useCallback(
    async (nodeTypeId: string, nodeType: RoadmapNodeTypeInput) => {
      if (!persistence?.updateNodeType) return missingOperation('guardar tipo de nodo');
      return (
        await mutate(
          () => persistence.updateNodeType!(stableInput, nodeTypeId, nodeType),
          'No se pudo guardar el tipo de nodo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const deleteNodeType = useCallback(
    async (nodeTypeId: string) => {
      if (!persistence?.deleteNodeType) return missingOperation('eliminar tipo de nodo');
      return (
        await mutate(
          () => persistence.deleteNodeType!(stableInput, nodeTypeId),
          'No se pudo eliminar el tipo de nodo.',
        )
      ).success;
    },
    [mutate, persistence, stableInput],
  );

  const completeNode = useCallback(
    async (nodeId: string) =>
      (
        await mutate(
          () => persistence?.complete(stableInput, nodeId) ?? missingOperation('completar nodo'),
          'No se pudo completar el nodo.',
        )
      ).success,
    [mutate, persistence, stableInput],
  );

  const completeSimulatedNode = useCallback(
    async (nodeId: string) => {
      if (!persistence?.completeSimulatedNode)
        return missingOperation('completar nodo en la previsualización');
      const result = await mutate(
        () => persistence.completeSimulatedNode!(stableInput, nodeId),
        'No se pudo completar el nodo en la previsualización.',
        false,
      );
      if (!result.success) return false;
      return loadSimulation();
    },
    [loadSimulation, mutate, persistence, stableInput],
  );

  const resetSimulation = useCallback(async () => {
    if (!persistence?.resetSimulation) return missingOperation('reiniciar previsualización');
    const result = await mutate(
      () => persistence.resetSimulation!(stableInput),
      'No se pudo reiniciar el progreso de previsualización.',
      false,
    );
    if (!result.success) return false;
    return loadSimulation();
  }, [loadSimulation, mutate, persistence, stableInput]);

  const dependencyWorkflow = useRoadmapDependencyWorkflow({
    roadmap: roadmapKey === key ? roadmap : null,
    previewRoadmapDependency,
    connectNodes,
    deleteDependency,
    onCreationSuccess: () => feedback?.showSuccess('Dependencia creada exitosamente.'),
    onDeletionSuccess: (deletedCount) =>
      feedback?.showSuccess(
        deletedCount === 1
          ? 'Dependencia eliminada exitosamente.'
          : 'Dependencias eliminadas exitosamente.',
      ),
  });

  return {
    roadmap: roadmapKey === key ? roadmap : null,
    simulationRoadmap: simulationKey === key ? simulationRoadmap : null,
    error: errorKey === key ? error : null,
    dismissError,
    loadSimulation,
    addNode,
    updateNode,
    moveNode,
    connectNodes,
    previewRoadmapDependency,
    previewTeacherBlock,
    changeTeacherBlock,
    deleteDependency,
    toggleVisibility,
    previewNodeVisibility,
    previewNodeDeletion,
    deleteNode,
    addResource,
    uploadResource,
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
    completeSimulatedNode,
    resetSimulation,
    dependencyWorkflow,
  };
}

export function useRoadmapCanvasSession(input: RoadmapCanvasSessionInput) {
  const persistence = useContext(persistenceContext);
  const legacy = useRoadmap(
    input.courseOffering.identifier,
    input.experience.kind,
    persistence === null,
  );
  const injected = useInjectedSession(input, persistence);
  return persistence ? injected : (legacy as unknown as InjectedSessionResult);
}

export function useRoadmapCanvasSessionPersistence() {
  return useContext(persistenceContext);
}

export { httpRoadmapCanvasSessionPersistence };
