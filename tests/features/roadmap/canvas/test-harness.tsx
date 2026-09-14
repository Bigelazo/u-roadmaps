import { forwardRef, type ReactNode, useImperativeHandle, useState } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { RoadmapCanvas as RoadmapCanvasComponent } from '@/features/roadmap';
import type {
  RoadmapGraphEditingIntent,
  RoadmapGraphOverlaySlots,
  RoadmapGraphProjection,
} from '@/features/roadmap/graph/RoadmapGraph';

export const RoadmapCanvasForTest = RoadmapCanvasComponent;

const { useRoadmapMock } = vi.hoisted(() => ({ useRoadmapMock: vi.fn() }));
export { useRoadmapMock };

vi.mock('next/dynamic', () => ({
  default: () =>
    forwardRef(function RoadmapEditorMock(
      {
        selectedNode,
        isOpen,
        onToggle,
        onClose,
        onPreview,
        onRequestTeacherBlock,
        onToggleVisibility,
        onUpdateNode,
        onAddResource,
        isVisibilityPending,
      }: {
        selectedNode?: { id: string; isTeacherBlocked: boolean };
        isOpen: boolean;
        onToggle: () => void;
        onClose: () => void;
        onPreview: (node: {
          id: string;
          title: string;
          description: string | null;
          nodeTypeId: string;
          positionX: number;
          positionY: number;
          isVisible: true;
          access: { status: 'ACCESSIBLE' };
          isCompleted: boolean;
          canComplete: boolean;
          resources: [];
        }) => void;
        onRequestTeacherBlock: (
          nodeId: string,
          operation: 'BLOCK' | 'UNBLOCK' | 'BRANCH_UNLOCK',
        ) => void;
        onToggleVisibility: (nodeId: string, isVisible: boolean) => void;
        onUpdateNode: (nodeId: string, node: unknown) => Promise<boolean>;
        onAddResource: (nodeId: string, resource: unknown) => Promise<boolean>;
        isVisibilityPending: boolean;
      },
      ref,
    ) {
      const [isDirty, setIsDirty] = useState(false);
      useImperativeHandle(
        ref,
        () => ({
          draftNodeId: selectedNode?.id ?? null,
          isDirty,
          reset: () => setIsDirty(false),
        }),
        [isDirty, selectedNode?.id],
      );

      return isOpen ? (
        <aside data-testid="editor-panel">
          <button type="button" onClick={onToggle}>
            Ocultar panel de edición
          </button>
          {selectedNode ? (
            <>
              <button type="button" onClick={onClose}>
                Deseleccionar nodo
              </button>
              <button type="button" onClick={() => onRequestTeacherBlock(selectedNode.id, 'BLOCK')}>
                Bloquear rama
              </button>
              <button
                type="button"
                onClick={() => onRequestTeacherBlock(selectedNode.id, 'UNBLOCK')}
              >
                Desbloquear
              </button>
              <button
                type="button"
                disabled={isVisibilityPending}
                onClick={() => onToggleVisibility(selectedNode.id, true)}
              >
                Ocultar para estudiantes
              </button>
              <button
                type="button"
                onClick={() => void onUpdateNode(selectedNode.id, { title: 'Límites' })}
              >
                Guardar cambios
              </button>
              <button
                type="button"
                onClick={() =>
                  void onAddResource(selectedNode.id, {
                    title: 'Guía de ejercicios',
                    url: 'https://example.test/guia',
                    type: 'LINK',
                  })
                }
              >
                Guardar enlace
              </button>
              <button
                type="button"
                onClick={() =>
                  onPreview({
                    id: selectedNode.id,
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
                  })
                }
              >
                Previsualizar
              </button>
              <button type="button" onClick={() => setIsDirty(true)}>
                Marcar borrador sin guardar
              </button>
            </>
          ) : null}
        </aside>
      ) : null;
    }),
}));

vi.mock('@/features/roadmap/graph/RoadmapGraph', () => ({
  RoadmapGraph: ({
    onSelectNode,
    onClearSelectedNode,
    selectedNodeId,
    topRightActions,
    projection,
    onViewportChange,
    restoreViewport,
    overlaySlots,
  }: {
    onSelectNode: (nodeId: string, trigger: HTMLElement) => void;
    onClearSelectedNode?: () => void;
    selectedNodeId?: string | null;
    projection: RoadmapGraphProjection;
    onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
    restoreViewport?: { x: number; y: number; zoom: number } | null;
    topRightActions?: (findOpenPosition: (title: string) => { x: number; y: number } | null) => ReactNode;
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
        <output data-testid="roadmap-mode">{canEdit ? 'editing' : 'student'}</output>
        <output data-testid="roadmap-projection">
          {projection.kind === 'teaching' ? 'teacher' : 'student'}
        </output>
        <output data-testid="displayed-roadmap">{projection.roadmap.roadmap.id}</output>
        <output data-testid="restored-viewport">{restoreViewport?.x ?? 'none'}</output>
        <button
          type="button"
          onClick={() => onSelectNode('blocked-node', document.createElement('div'))}
        >
          Activar nodo bloqueado
        </button>
        <button type="button" onClick={() => onSelectNode('node-1', document.createElement('div'))}>
          Activar nodo docente
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
        <button
          type="button"
          onClick={() => onSelectNode('missing-node', document.createElement('div'))}
        >
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

export function renderCanvas(canEdit = false) {
  return render(
    <RoadmapCanvasComponent
      identifier={identifier}
      canEdit={canEdit}
      title="Programación I"
      courseCode="CC1001"
      year={2026}
      semester={2}
    />,
  );
}
