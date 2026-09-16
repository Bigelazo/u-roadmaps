import { forwardRef, type ReactNode, useImperativeHandle, useMemo } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import {
  createInMemoryRoadmapSessionPersistence,
  RoadmapCanvasSession,
} from '@/features/roadmap/session';
import { RoadmapCanvasSessionPersistenceProvider } from '@/features/roadmap/session/session';
import type { AnyRoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';
import type { NodeEditorProps } from '@/features/roadmap/editor/types';
import type {
  RoadmapGraphEditingIntent,
  RoadmapGraphOverlaySlots,
  RoadmapGraphProjection,
} from '@/features/roadmap/graph/RoadmapGraph';

const { nodeEditorGuardMock, useRoadmapMock } = vi.hoisted(() => ({
  nodeEditorGuardMock: vi.fn(),
  useRoadmapMock: vi.fn(),
}));
export { nodeEditorGuardMock, useRoadmapMock };

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function NodeEditorMock(
      { session, command, perform, onIntent }: NodeEditorProps,
      ref,
    ) {
      const { node, isVisibilityPending } = session;
      useImperativeHandle(ref, () => ({ guardDraft: nodeEditorGuardMock }), []);

      return (
        <aside data-testid="editor-panel">
          <output data-testid="node-editor-command-id">{command?.id}</output>
          {node ? (
            <>
              <button type="button" onClick={() => onIntent({ kind: 'close', nodeId: node.id })}>
                Deseleccionar nodo
              </button>
              <button
                type="button"
                onClick={() =>
                  onIntent({ kind: 'change-teacher-block', nodeId: node.id, operation: 'BLOCK' })
                }
              >
                Bloquear rama
              </button>
              <button
                type="button"
                onClick={() =>
                  onIntent({
                    kind: 'change-teacher-block',
                    nodeId: node.id,
                    operation: 'UNBLOCK',
                  })
                }
              >
                Desbloquear
              </button>
              <button
                type="button"
                disabled={isVisibilityPending}
                onClick={() =>
                  onIntent({ kind: 'change-visibility', nodeId: node.id, isVisible: true })
                }
              >
                Ocultar para estudiantes
              </button>
              <button
                type="button"
                onClick={() =>
                  void perform({
                    kind: 'update-node',
                    nodeId: node.id,
                    value: {
                      title: 'Límites',
                      description: node.description ?? '',
                      nodeTypeId: node.nodeTypeId,
                    },
                  })
                }
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() =>
                  void perform({
                    kind: 'add-resource',
                    nodeId: node.id,
                    resource: {
                      title: 'Guía de ejercicios',
                      url: 'https://example.test/guia',
                      type: 'LINK',
                    },
                  })
                }
              >
                Guardar enlace
              </button>
              <button
                type="button"
                onClick={() =>
                  onIntent({
                    kind: 'preview-node-information',
                    node: {
                      id: node.id,
                      title: 'Vista previa docente',
                      description: 'Borrador visible',
                      nodeTypeId: 'content',
                      positionX: 0,
                      positionY: 0,
                      isVisible: true,
                      access: { status: 'ACCESSIBLE' },
                      isCompleted: false,
                      canComplete: true,
                      resources: [],
                    },
                    returnFocus: () => {},
                  })
                }
              >
                Previsualizar
              </button>
              <button
                type="button"
                onClick={() => onIntent({ kind: 'delete-node', nodeId: node.id })}
              >
                Solicitar eliminar nodo desde el editor
              </button>
            </>
          ) : null}
        </aside>
      );
    }),
}));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    onSelectNode,
    onClearSelectedNode,
    selectedNodeId,
    focusReturnRequest,
    topRightActions,
    projection,
    onViewportChange,
    viewportRestoration,
    overlaySlots,
  }: {
    onSelectNode: (nodeId: string) => void;
    onClearSelectedNode?: () => void;
    selectedNodeId?: string | null;
    focusReturnRequest?: string | null;
    projection: RoadmapGraphProjection;
    onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
    viewportRestoration?: {
      token: string;
      viewport: { x: number; y: number; zoom: number };
    } | null;
    topRightActions?: (
      findOpenPosition: (title: string) => { x: number; y: number } | null,
    ) => ReactNode;
    overlaySlots?: RoadmapGraphOverlaySlots;
  }) => {
    const editing = projection.kind === 'teaching' ? projection.editing : undefined;
    const canEdit = editing !== undefined;
    const emitEditingIntent = (intent: RoadmapGraphEditingIntent) =>
      editing?.onEditingIntent(intent);
    return (
      <>
        <div data-testid="roadmap-overlay-top-left">{overlaySlots?.topLeft}</div>
        <div data-testid="roadmap-overlay-top-center">{overlaySlots?.topCenter}</div>
        <div data-testid="roadmap-overlay-bottom-right">{overlaySlots?.bottomRight}</div>
        {topRightActions?.(() => ({ x: 280, y: 260 }))}
        <output data-testid="selected-roadmap-node">{selectedNodeId}</output>
        <output data-testid="focus-return-request">{focusReturnRequest}</output>
        <output data-testid="roadmap-mode">{canEdit ? 'editing' : 'student'}</output>
        <output data-testid="roadmap-projection">
          {projection.kind === 'teaching' ? 'teacher' : 'student'}
        </output>
        <output data-testid="displayed-roadmap">{projection.roadmap.roadmap.id}</output>
        <output data-testid="restored-viewport">{viewportRestoration?.viewport.x ?? 'none'}</output>
        <button type="button" onClick={() => onSelectNode('blocked-node')}>
          Activar nodo bloqueado
        </button>
        <button type="button" onClick={() => onSelectNode('node-1')}>
          Activar nodo docente
        </button>
        <button type="button" onClick={() => onSelectNode('node-2')}>
          Activar segundo nodo docente
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({ kind: 'change-visibility', nodeId: 'node-1', isVisible: false })
          }
        >
          Solicitar ocultar nodo
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({ kind: 'change-visibility', nodeId: 'node-1', isVisible: true })
          }
        >
          Solicitar mostrar nodo
        </button>
        <button
          type="button"
          onClick={() => emitEditingIntent({ kind: 'add-resource', nodeId: 'node-1' })}
        >
          Agregar recurso al nodo actual
        </button>
        <button
          type="button"
          onClick={() => emitEditingIntent({ kind: 'add-resource', nodeId: 'node-2' })}
        >
          Agregar recurso a otro nodo
        </button>
        <button
          type="button"
          onClick={() => emitEditingIntent({ kind: 'delete-node', nodeId: 'node-1' })}
        >
          Solicitar eliminar nodo
        </button>
        <button type="button" onClick={() => onSelectNode('missing-node')}>
          Activar nodo inexistente
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({
              kind: 'delete-dependencies',
              dependencyIds: ['dependency-1', 'dependency-2'],
            })
          }
        >
          Solicitar eliminación de dependencias
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({
              kind: 'create-dependency',
              sourceNodeId: 'source-node',
              targetNodeId: 'target-node',
              sourceHandle: 'right',
              targetHandle: 'left',
            })
          }
        >
          Conectar rama bloqueada
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({
              kind: 'node-positions',
              cause: 'automatic-layout',
              positions: [{ nodeId: 'node-1', position: { x: 40, y: 80 } }],
            })
          }
        >
          Ordenar mapa
        </button>
        <button type="button" onClick={onClearSelectedNode}>
          Cerrar nodo con Escape
        </button>
        <button
          type="button"
          onClick={() =>
            emitEditingIntent({
              kind: 'node-positions',
              cause: 'keyboard',
              positions: [{ nodeId: 'node-1', position: { x: 20, y: 0 } }],
            })
          }
        >
          Mover nodo con teclado
        </button>
        <button type="button" onClick={() => onViewportChange?.({ x: 100, y: 0, zoom: 1 })}>
          Mover viewport a 100
        </button>
        <button type="button" onClick={() => onViewportChange?.({ x: 400, y: 0, zoom: 1 })}>
          Mover viewport a 400
        </button>
      </>
    );
  },
}));

vi.mock('@/features/roadmap/student/NodeDetail', () => ({
  StudentNodeDetail: ({
    node,
    status,
    onClose,
    onComplete,
    isReadOnly,
    panelWidth,
  }: {
    node?: { title: string };
    status: string | null;
    onClose: () => void;
    onComplete: (node: { title: string }) => void;
    isReadOnly?: boolean;
    panelWidth?: number;
  }) =>
    node ? (
      <aside data-testid="student-detail" data-panel-width={panelWidth}>
        <p>{node.title}</p>
        <p>{status}</p>
        <button type="button" disabled={isReadOnly} onClick={() => onComplete(node)}>
          Completar
        </button>
        <button type="button" onClick={onClose}>
          Cerrar detalle
        </button>
      </aside>
    ) : null,
}));

vi.mock('@/features/roadmap/useRoadmap', () => ({ useRoadmap: useRoadmapMock }));

beforeEach(() => {
  nodeEditorGuardMock.mockReset();
  nodeEditorGuardMock.mockResolvedValue(true);
  useRoadmapMock.mockReset();
});

export const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: null,
      nodeTypeId: 'content',
      positionX: 0,
      positionY: 0,
      isVisible: true,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [],
};

export const identifier = { courseCode: 'CC1001', year: 2026, semester: 2 };

export function roadmapActions(overrides = {}) {
  return {
    roadmap,
    error: null,
    dismissError: vi.fn(),
    addNode: vi.fn(),
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    connectNodes: vi.fn(),
    previewRoadmapDependency: vi.fn().mockResolvedValue([]),
    previewTeacherBlock: vi
      .fn()
      .mockResolvedValue({ mode: 'BLOCK', version: 'preview', nodes: [] }),
    changeTeacherBlock: vi.fn(),
    deleteDependency: vi.fn(),
    toggleVisibility: vi.fn(),
    previewNodeVisibility: vi.fn().mockResolvedValue([]),
    previewNodeDeletion: vi.fn().mockResolvedValue({
      node: {
        title: 'Límites',
        nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' },
      },
      dependencies: [],
      resources: [],
      version: 'delete-preview',
    }),
    deleteNode: vi.fn(),
    addResource: vi.fn(),
    uploadResource: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    addNodeType: vi.fn(),
    updateNodeType: vi.fn(),
    deleteNodeType: vi.fn(),
    completeNode: vi.fn(),
    simulationRoadmap: null,
    loadSimulation: vi.fn().mockResolvedValue(true),
    completeSimulatedNode: vi.fn().mockResolvedValue(true),
    resetSimulation: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

type TestRoadmapActions = ReturnType<typeof roadmapActions>;

function createSessionPersistence(actions: TestRoadmapActions): RoadmapCanvasSessionPersistence {
  const initialRoadmap = actions.roadmap;
  if (!initialRoadmap) {
    return {
      async load() {
        throw new Error(actions.error ?? 'No se pudo cargar el roadmap.');
      },
      async complete() {},
    };
  }

  const memory = createInMemoryRoadmapSessionPersistence(initialRoadmap as AnyRoadmapDto);
  const runAction = async (name: keyof TestRoadmapActions, args: unknown[], fallback: string) => {
    const action = actions[name];
    if (typeof action !== 'function') return undefined;
    const result = await (action as (...actionArgs: unknown[]) => unknown)(...args);
    if (result === false) throw new Error(actions.error ?? fallback);
    return result;
  };

  const persistence: RoadmapCanvasSessionPersistence & { initialRoadmap: AnyRoadmapDto } = {
    initialRoadmap: initialRoadmap as AnyRoadmapDto,
    async load(input) {
      return memory.load(input);
    },
    async complete(input, nodeId) {
      await runAction('completeNode', [nodeId], 'No se pudo completar el nodo.');
      await memory.complete(input, nodeId);
    },
    async loadSimulation(input) {
      const result = await runAction(
        'loadSimulation',
        [],
        'No se pudo cargar la previsualización.',
      );
      if (result === false)
        throw new Error(actions.error ?? 'No se pudo cargar la previsualización.');
      if (actions.simulationRoadmap)
        return structuredClone(actions.simulationRoadmap as StudentRoadmapDto);
      return memory.loadSimulation!(input);
    },
    async addNode(input, node, position) {
      let createdNodeId: string | undefined;
      await runAction(
        'addNode',
        [
          node,
          position,
          (nodeId: string) => {
            createdNodeId = nodeId;
          },
        ],
        'No se pudo crear el nodo.',
      );
      const generatedNodeId = await memory.addNode!(input, node, position);
      return createdNodeId ?? generatedNodeId;
    },
    async updateNode(input, nodeId, update) {
      await runAction('updateNode', [nodeId, update], 'No se pudo guardar el nodo.');
      await memory.updateNode!(input, nodeId, update);
    },
    async moveNode(input, nodeId, position) {
      await runAction('moveNode', [nodeId, position], 'No se pudo guardar la posición.');
      await memory.moveNode!(input, nodeId, position);
    },
    async connectNodes(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle) {
      await runAction(
        'connectNodes',
        [sourceNodeId, targetNodeId, sourceHandle, targetHandle],
        'No se pudo crear la dependencia.',
      );
      await memory.connectNodes!(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle);
    },
    async previewRoadmapDependency(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle) {
      const result = await runAction(
        'previewRoadmapDependency',
        [sourceNodeId, targetNodeId, sourceHandle, targetHandle],
        'No se pudo calcular el impacto de la dependencia.',
      );
      return result === undefined
        ? memory.previewRoadmapDependency!(
            input,
            sourceNodeId,
            targetNodeId,
            sourceHandle,
            targetHandle,
          )
        : (result as { id: string; title: string }[]);
    },
    async previewTeacherBlock(input, nodeId, operation) {
      const result = await runAction(
        'previewTeacherBlock',
        [nodeId, operation],
        'No se pudo calcular el impacto del bloqueo docente.',
      );
      return result === undefined
        ? memory.previewTeacherBlock!(input, nodeId, operation)
        : (result as Awaited<
            ReturnType<NonNullable<RoadmapCanvasSessionPersistence['previewTeacherBlock']>>
          >);
    },
    async changeTeacherBlock(input, nodeId, operation, previewVersion) {
      await runAction(
        'changeTeacherBlock',
        [nodeId, operation, previewVersion],
        'No se pudo cambiar el bloqueo docente.',
      );
      await memory.changeTeacherBlock!(input, nodeId, operation, previewVersion);
    },
    async deleteDependency(input, dependencyId) {
      await runAction('deleteDependency', [dependencyId], 'No se pudo eliminar la dependencia.');
      await memory.deleteDependency!(input, dependencyId);
    },
    async toggleVisibility(input, nodeId, isVisible) {
      await runAction(
        'toggleVisibility',
        [nodeId, isVisible],
        'No se pudo cambiar la visibilidad.',
      );
      await memory.toggleVisibility!(input, nodeId, isVisible);
    },
    async previewNodeVisibility(input, nodeId) {
      const result = await runAction(
        'previewNodeVisibility',
        [nodeId],
        'No se pudo calcular el impacto de ocultar el nodo.',
      );
      return result === undefined
        ? memory.previewNodeVisibility!(input, nodeId)
        : (result as { id: string; sourceNodeId: string; targetNodeId: string }[]);
    },
    async previewNodeDeletion(input, nodeId) {
      const result = await runAction(
        'previewNodeDeletion',
        [nodeId],
        'No se pudo calcular el impacto de eliminar el nodo.',
      );
      return result === undefined
        ? memory.previewNodeDeletion!(input, nodeId)
        : (result as Awaited<
            ReturnType<NonNullable<RoadmapCanvasSessionPersistence['previewNodeDeletion']>>
          >);
    },
    async deleteNode(input, nodeId, previewVersion) {
      await runAction('deleteNode', [nodeId, previewVersion], 'No se pudo eliminar el nodo.');
      await memory.deleteNode!(input, nodeId, previewVersion);
    },
    async addResource(input, nodeId, resource) {
      await runAction('addResource', [nodeId, resource], 'No se pudo agregar el recurso.');
      await memory.addResource!(input, nodeId, resource);
    },
    async uploadResource(input, nodeId, file) {
      await runAction('uploadResource', [nodeId, file], 'No se pudo subir el archivo.');
      await memory.uploadResource!(input, nodeId, file);
    },
    async updateResource(input, resourceId, resource) {
      await runAction('updateResource', [resourceId, resource], 'No se pudo guardar el recurso.');
      await memory.updateResource!(input, resourceId, resource);
    },
    async deleteResource(input, resourceId) {
      await runAction('deleteResource', [resourceId], 'No se pudo eliminar el recurso.');
      await memory.deleteResource!(input, resourceId);
    },
    async addNodeType(input, nodeType) {
      await runAction('addNodeType', [nodeType], 'No se pudo crear el tipo de nodo.');
      await memory.addNodeType!(input, nodeType);
    },
    async updateNodeType(input, nodeTypeId, nodeType) {
      await runAction(
        'updateNodeType',
        [nodeTypeId, nodeType],
        'No se pudo guardar el tipo de nodo.',
      );
      await memory.updateNodeType!(input, nodeTypeId, nodeType);
    },
    async deleteNodeType(input, nodeTypeId) {
      await runAction('deleteNodeType', [nodeTypeId], 'No se pudo eliminar el tipo de nodo.');
      await memory.deleteNodeType!(input, nodeTypeId);
    },
    async completeSimulatedNode(input, nodeId) {
      await runAction(
        'completeSimulatedNode',
        [nodeId],
        'No se pudo completar el nodo en la previsualización.',
      );
      await memory.completeSimulatedNode!(input, nodeId);
    },
    async resetSimulation(input) {
      await runAction(
        'resetSimulation',
        [],
        'No se pudo reiniciar el progreso de previsualización.',
      );
      await memory.resetSimulation!(input);
    },
  };
  return persistence;
}

type RoadmapCanvasTestProps = {
  identifier: typeof identifier;
  canEdit?: boolean;
  canPreview?: boolean;
  isHistorical?: boolean;
  title: string;
  courseCode: string;
  year: number;
  semester: number;
};

export function RoadmapCanvasForTest({
  identifier,
  canEdit,
  canPreview,
  isHistorical,
  title,
}: RoadmapCanvasTestProps) {
  const actions = (useRoadmapMock() as TestRoadmapActions | undefined) ?? roadmapActions();
  const persistence = useMemo(() => createSessionPersistence(actions), [actions]);
  return (
    <RoadmapCanvasSessionPersistenceProvider persistence={persistence}>
      <RoadmapCanvasSession
        courseOffering={{ identifier, title }}
        experience={{
          kind: canEdit || canPreview ? 'teaching' : 'student',
          term: isHistorical ? 'historical' : 'current',
        }}
      />
    </RoadmapCanvasSessionPersistenceProvider>
  );
}

export function renderCanvas(canEdit = false) {
  return render(
    <RoadmapCanvasForTest
      identifier={identifier}
      canEdit={canEdit}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );
}
