'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type Resource,
  type AnyRoadmapDto,
  type CourseOfferingIdentifier,
  type TeacherBlockImpact,
  type TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import { roadmapUrl } from '@/features/roadmap/client';
import type { Point } from '@/features/roadmap/graph/geometry';

type NewNode = {
  title: string;
  description: string;
  nodeTypeId: string;
  isVisible: boolean;
};

type NodeUpdate = { title: string; description: string; nodeTypeId: string };
type NewResource = { title: string; url: string; type: Resource['type'] };
type ResourceUpdate = NewResource;
type NodeTypeInput = { name: string; icon: NodeTypeIconId; color: NodeTypeColor };
export type StructuralDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};
export type { TeacherBlockImpact, TeacherBlockOperation } from '@/features/roadmap/types';

function identifierKey(identifier: CourseOfferingIdentifier) {
  return `${identifier.courseCode}:${identifier.year}:${identifier.semester}`;
}

function isRoadmapDto(value: unknown): value is AnyRoadmapDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    'nodeTypes' in value &&
    Array.isArray(value.nodeTypes)
  );
}

function apiErrorMessage(value: unknown) {
  if (typeof value !== 'object' || value === null || !('error' in value)) return undefined;
  const error = value.error;
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
}

function isStructuralDependency(value: unknown): value is StructuralDependency {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'sourceNodeId' in value &&
    typeof value.sourceNodeId === 'string' &&
    'targetNodeId' in value &&
    typeof value.targetNodeId === 'string'
  );
}

function isTeacherBlockImpact(value: unknown): value is TeacherBlockImpact {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'title' in value &&
    typeof value.title === 'string'
  );
}

function isVisibilityPreview(value: unknown): value is { dependencies: StructuralDependency[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'dependencies' in value &&
    Array.isArray(value.dependencies) &&
    value.dependencies.every(isStructuralDependency)
  );
}

function isDependencyPreview(value: unknown): value is { nodes: TeacherBlockImpact[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodes' in value &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isTeacherBlockImpact)
  );
}

async function responseError(response: Response, fallback: string) {
  try {
    return apiErrorMessage(await response.json()) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useRoadmap(identifier: CourseOfferingIdentifier) {
  const [roadmap, setRoadmap] = useState<AnyRoadmapDto | null>(null);
  const [roadmapKey, setRoadmapKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const activeIdentifierRef = useRef<string | null>(null);
  const lastMutationErrorRef = useRef<string | null>(null);
  const key = identifierKey(identifier);

  useEffect(() => {
    activeIdentifierRef.current = key;
  }, [key]);

  const load = useCallback(async () => {
    const requestKey = identifierKey(identifier);
    if (activeIdentifierRef.current !== requestKey) return false;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestVersion = ++requestVersionRef.current;

    try {
      const response = await fetch(roadmapUrl(identifier), { signal: controller.signal });
      const body: unknown = response.ok ? await response.json() : undefined;
      const message = response.ok
        ? undefined
        : await responseError(response, 'No se pudo cargar el roadmap.');
      if (
        controller.signal.aborted ||
        requestVersion !== requestVersionRef.current ||
        activeIdentifierRef.current !== requestKey
      ) {
        return false;
      }
      if (!response.ok || !isRoadmapDto(body)) {
        setRoadmap(null);
        setRoadmapKey(requestKey);
        setError(message ?? 'No se pudo cargar el roadmap.');
        setErrorKey(requestKey);
        return false;
      }
      setRoadmap(body);
      setRoadmapKey(requestKey);
      setError(null);
      setErrorKey(null);
      return true;
    } catch (cause) {
      if (
        controller.signal.aborted ||
        requestVersion !== requestVersionRef.current ||
        activeIdentifierRef.current !== requestKey
      ) {
        return false;
      }
      setRoadmap(null);
      setRoadmapKey(requestKey);
      setError(
        cause instanceof Error && cause.name === 'AbortError'
          ? null
          : 'No se pudo cargar el roadmap.',
      );
      setErrorKey(requestKey);
      return false;
    }
  }, [identifier]);

  useEffect(() => {
    void load();
    return () => {
      controllerRef.current?.abort();
      requestVersionRef.current += 1;
    };
  }, [load]);

  const dismissError = useCallback(() => {
    lastMutationErrorRef.current = null;
    setError(null);
    setErrorKey(null);
  }, []);

  const mutate = useCallback(
    async (
      url: string,
      init: RequestInit,
      fallback: string,
      onSuccess?: (response: Response) => Promise<void>,
    ) => {
      const requestKey = identifierKey(identifier);
      try {
        const response = await fetch(url, {
          ...init,
          headers:
            init.body instanceof FormData
              ? init.headers
              : { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        });
        if (response.ok) {
          await onSuccess?.(response);
          return true;
        }
        const message = await responseError(response, fallback);
        if (activeIdentifierRef.current === requestKey) {
          lastMutationErrorRef.current = message;
          setError(message);
          setErrorKey(requestKey);
        }
      } catch {
        if (activeIdentifierRef.current === requestKey) {
          lastMutationErrorRef.current = fallback;
          setError(fallback);
          setErrorKey(requestKey);
        }
      }
      return false;
    },
    [identifier],
  );

  const preview = useCallback(
    async <T>(url: string, isPreview: (value: unknown) => value is T, fallback: string) => {
      const requestKey = identifierKey(identifier);
      try {
        const response = await fetch(url);
        if (response.ok) {
          const body: unknown = await response.json();
          if (isPreview(body)) return activeIdentifierRef.current === requestKey ? body : null;
        }
        const message = response.ok ? fallback : await responseError(response, fallback);
        if (activeIdentifierRef.current === requestKey) {
          setError(message);
          setErrorKey(requestKey);
        }
      } catch {
        if (activeIdentifierRef.current === requestKey) {
          setError(fallback);
          setErrorKey(requestKey);
        }
      }
      return null;
    },
    [identifier],
  );

  const addNode = useCallback(
    async (node: NewNode, position: Point, onCreated?: (nodeId: string) => void) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, '/nodes'),
        {
          method: 'POST',
          body: JSON.stringify({
            ...node,
            description: node.description || null,
            positionX: position.x,
            positionY: position.y,
          }),
        },
        'No se pudo crear el nodo.',
        async (response) => {
          const body: unknown = await response.json();
          if (
            typeof body === 'object' &&
            body !== null &&
            'node' in body &&
            typeof body.node === 'object' &&
            body.node !== null &&
            'id' in body.node &&
            typeof body.node.id === 'string'
          ) {
            onCreated?.(body.node.id);
          }
        },
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const updateNode = useCallback(
    async (nodeId: string, node: NodeUpdate) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}`),
        {
          method: 'PATCH',
          body: JSON.stringify({ ...node, description: node.description || null }),
        },
        'No se pudo guardar el nodo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const moveNode = useCallback(
    async (nodeId: string, position: { x: number; y: number }) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}`),
        { method: 'PATCH', body: JSON.stringify({ positionX: position.x, positionY: position.y }) },
        'No se pudo guardar la posición.',
      );
      if (!succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const connectNodes = useCallback(
    async (
      sourceNodeId: string,
      targetNodeId: string,
      sourceHandle?: string,
      targetHandle?: string,
    ) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, '/dependencies'),
        {
          method: 'POST',
          body: JSON.stringify({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }),
        },
        'No se pudo crear la dependencia.',
      );
      await load();
      const requestKey = identifierKey(identifier);
      if (!succeeded && activeIdentifierRef.current === requestKey) {
        setError(lastMutationErrorRef.current ?? 'No se pudo crear la dependencia.');
        setErrorKey(requestKey);
      }
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const deleteDependency = useCallback(
    async (dependencyId: string) => {
      const requestKey = identifierKey(identifier);
      const succeeded = await mutate(
        roadmapUrl(identifier, `/dependencies/${dependencyId}`),
        { method: 'DELETE' },
        'No se pudo eliminar la dependencia.',
      );
      if (succeeded && activeIdentifierRef.current === requestKey)
        setRoadmap((current) =>
          current
            ? {
                ...current,
                dependencies: current.dependencies.filter(({ id }) => id !== dependencyId),
              }
            : current,
        );
      return succeeded;
    },
    [identifier, mutate],
  );

  const toggleVisibility = useCallback(
    async (nodeId: string, isVisible: boolean) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}`),
        { method: 'PATCH', body: JSON.stringify({ isVisible: !isVisible }) },
        'No se pudo cambiar la visibilidad.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const previewNodeVisibility = useCallback(
    async (nodeId: string) => {
      const result = await preview(
        roadmapUrl(identifier, `/nodes/${nodeId}?operation=HIDE`),
        isVisibilityPreview,
        'No se pudo calcular el impacto de ocultar el nodo.',
      );
      return result?.dependencies ?? null;
    },
    [identifier, preview],
  );

  const previewRoadmapDependency = useCallback(
    async (
      sourceNodeId: string,
      targetNodeId: string,
      sourceHandle?: string,
      targetHandle?: string,
    ) => {
      const query = new URLSearchParams({ sourceNodeId, targetNodeId });
      if (sourceHandle) query.set('sourceHandle', sourceHandle);
      if (targetHandle) query.set('targetHandle', targetHandle);
      const result = await preview(
        roadmapUrl(identifier, `/dependencies?${query}`),
        isDependencyPreview,
        'No se pudo calcular el impacto de la dependencia.',
      );
      return result?.nodes ?? null;
    },
    [identifier, preview],
  );

  const previewTeacherBlock = useCallback(
    async (nodeId: string, operation: TeacherBlockOperation) => {
      const result = await preview(
        roadmapUrl(identifier, `/nodes/${nodeId}/teacher-block?operation=${operation}`),
        isDependencyPreview,
        'No se pudo calcular el impacto del bloqueo docente.',
      );
      return result?.nodes ?? null;
    },
    [identifier, preview],
  );

  const changeTeacherBlock = useCallback(
    async (nodeId: string, operation: TeacherBlockOperation) => {
      const method = operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH';
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}/teacher-block`),
        { method },
        'No se pudo cambiar el bloqueo docente.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const deleteNode = useCallback(
    async (nodeId: string) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}`),
        { method: 'DELETE' },
        'No se pudo eliminar el nodo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const addResource = useCallback(
    async (nodeId: string, resource: NewResource) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}/resources`),
        { method: 'POST', body: JSON.stringify(resource) },
        'No se pudo agregar el recurso.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const uploadResource = useCallback(
    async (nodeId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}/resources`),
        { method: 'POST', body: formData },
        'No se pudo subir el archivo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const updateResource = useCallback(
    async (resourceId: string, resource: ResourceUpdate) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/resources/${resourceId}`),
        { method: 'PATCH', body: JSON.stringify(resource) },
        'No se pudo guardar el recurso.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const deleteResource = useCallback(
    async (resourceId: string) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/resources/${resourceId}`),
        { method: 'DELETE' },
        'No se pudo eliminar el recurso.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const addNodeType = useCallback(
    async (nodeType: NodeTypeInput) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, '/node-types'),
        { method: 'POST', body: JSON.stringify(nodeType) },
        'No se pudo crear el tipo de nodo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const updateNodeType = useCallback(
    async (nodeTypeId: string, nodeType: NodeTypeInput) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/node-types/${nodeTypeId}`),
        { method: 'PATCH', body: JSON.stringify(nodeType) },
        'No se pudo guardar el tipo de nodo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const deleteNodeType = useCallback(
    async (nodeTypeId: string) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/node-types/${nodeTypeId}`),
        { method: 'DELETE' },
        'No se pudo eliminar el tipo de nodo.',
      );
      if (succeeded) await load();
      return succeeded;
    },
    [identifier, load, mutate],
  );

  const completeNode = useCallback(
    async (nodeId: string) => {
      const succeeded = await mutate(
        roadmapUrl(identifier, `/nodes/${nodeId}/completion`),
        { method: 'POST' },
        'No se pudo completar el nodo.',
      );
      await load();
      if (!succeeded && activeIdentifierRef.current === identifierKey(identifier)) {
        setError(lastMutationErrorRef.current ?? 'No se pudo completar el nodo.');
        setErrorKey(identifierKey(identifier));
      }
      return succeeded;
    },
    [identifier, load, mutate],
  );

  return {
    roadmap: roadmapKey === key ? roadmap : null,
    error: errorKey === key ? error : null,
    dismissError,
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
    deleteNode,
    addResource,
    uploadResource,
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
  };
}
