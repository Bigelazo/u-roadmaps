import { type ReactNode } from 'react';
import type { NodeProps } from '@xyflow/react';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { RoadmapGraph, type RoadmapGraphEditing } from '@/features/roadmap/graph/RoadmapGraph';
import { RoadmapNode, type RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import type { RoadmapDto, StudentRoadmapDto } from '@/features/roadmap/types';

type ReactFlowMockProps = {
  nodes?: RoadmapFlowNode[];
  edges?: RoadmapFlowEdge[];
  children?: ReactNode;
  className?: string;
};

function nodeProps(node: RoadmapFlowNode): NodeProps<RoadmapFlowNode> {
  return {
    id: node.id,
    data: node.data,
    width: node.measured?.width,
    height: node.measured?.height,
    sourcePosition: node.sourcePosition,
    targetPosition: node.targetPosition,
    dragHandle: node.dragHandle,
    parentId: node.parentId,
    type: node.type,
    dragging: false,
    zIndex: node.zIndex ?? 0,
    selectable: node.selectable ?? true,
    deletable: node.deletable ?? true,
    selected: node.selected ?? false,
    draggable: node.draggable ?? true,
    isConnectable: node.connectable ?? true,
    positionAbsoluteX: node.position.x,
    positionAbsoluteY: node.position.y,
  };
}

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Lines: 'lines' },
  ConnectionMode: { Loose: 'loose' },
  ControlButton: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Controls: ({ children }: { children: ReactNode }) => <>{children}</>,
  Handle: () => null,
  MarkerType: { ArrowClosed: 'arrow-closed' },
  Panel: ({ children, position, ...props }: { children: ReactNode; position: string }) => (
    <div data-testid={`roadmap-panel-${position}`} {...props}>
      {children}
    </div>
  ),
  Position: { Top: 'top', Right: 'right', Bottom: 'bottom', Left: 'left' },
  ReactFlow: ({ nodes = [], edges = [], children, className }: ReactFlowMockProps) => {
    return (
      <div data-testid="roadmap-flow" className={className}>
        {nodes.map((node) => (
          <RoadmapNode key={node.id} {...nodeProps(node)} />
        ))}
        {edges.map((edge) => (
          <output key={edge.id} data-testid={`dependency-${edge.id}`}>
            {edge.sourceHandle}:{edge.targetHandle}
          </output>
        ))}
        {children}
      </div>
    );
  },
  applyEdgeChanges: <T,>(changes: T[], edges: T[]) => edges,
  applyNodeChanges: <T extends { id: string; position: { x: number; y: number } }>(
    changes: { id: string; type: string; position?: { x: number; y: number } }[],
    nodes: T[],
  ) =>
    nodes.map((node) => {
      const change = changes.find(
        (candidate) => candidate.id === node.id && candidate.type === 'position',
      );
      return change?.position ? { ...node, position: change.position } : node;
    }),
  useReactFlow: () => ({
    fitView: vi.fn(),
    screenToFlowPosition: (position: { x: number; y: number }) => position,
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    setViewport: vi.fn(),
  }),
}));

const teacherRoadmap: RoadmapDto = {
  course: { code: 'CC1001', name: 'Introducción', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [
    { id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8', isPredefined: true },
  ],
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      description: 'Introducción',
      positionX: 0,
      positionY: 0,
      nodeTypeId: 'content',
      isVisible: true,
      isTeacherBlocked: false,
      resources: [
        { id: 'resource-1', title: 'Guía', url: 'https://example.test/guide', type: 'FILE' },
      ],
    },
    {
      id: 'node-2',
      title: 'Derivadas',
      description: null,
      positionX: 300,
      positionY: 180,
      nodeTypeId: 'content',
      isVisible: false,
      isTeacherBlocked: false,
      resources: [],
    },
  ],
  dependencies: [
    {
      id: 'dependency-1',
      sourceNodeId: 'node-1',
      targetNodeId: 'node-2',
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
  ],
};

const studentRoadmap: StudentRoadmapDto = {
  ...teacherRoadmap,
  nodes: [
    {
      id: 'node-1',
      title: 'Límites',
      positionX: 0,
      positionY: 0,
      nodeTypeId: 'content',
      isVisible: true,
      access: { status: 'ACCESSIBLE' },
      description: 'Introducción',
      isCompleted: true,
      canComplete: false,
      resources: [
        { id: 'resource-1', title: 'Guía', url: 'https://example.test/guide', type: 'FILE' },
      ],
    },
    {
      id: 'node-2',
      title: 'Derivadas',
      positionX: 300,
      positionY: 180,
      nodeTypeId: 'content',
      access: { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' },
    },
  ],
};

function editingCapability(overrides: Partial<RoadmapGraphEditing> = {}): RoadmapGraphEditing {
  return {
    onMoveNode: vi.fn(),
    onKeyboardNodeMove: vi.fn(),
    onConnectNodes: vi.fn(),
    onDeleteDependencies: vi.fn(),
    onAutoLayout: vi.fn(),
    onRequestAccessAction: vi.fn(),
    onRequestVisibilityAction: vi.fn(),
    onRequestAddResource: vi.fn(),
    onRequestDelete: vi.fn(),
    ...overrides,
  };
}

const commonProps = {
  onSelectNode: vi.fn(),
};

test('renders teaching Nodes, Resources, hidden state, and Dependencies through the graph interface', () => {
  render(
    <RoadmapGraph projection={{ kind: 'teaching', roadmap: teacherRoadmap }} {...commonProps} />,
  );

  expect(screen.getByText('Límites')).toBeTruthy();
  expect(screen.getByLabelText('Derivadas: oculto para estudiantes')).toBeTruthy();
  expect(screen.getByLabelText('1 archivo')).toBeTruthy();
  expect(screen.getByTestId('dependency-dependency-1').textContent).toBe('bottom:top');
  expect(screen.queryByRole('button', { name: 'Abrir menú de acciones del nodo' })).toBeNull();
});

test('renders student Node state and resources without teaching controls', () => {
  render(
    <RoadmapGraph projection={{ kind: 'student', roadmap: studentRoadmap }} {...commonProps} />,
  );

  expect(screen.getByLabelText('Completado')).toBeTruthy();
  expect(screen.getByLabelText('Bloqueado')).toBeTruthy();
  expect(screen.getByLabelText('1 archivo')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Ordenar horizontalmente' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Abrir menú de acciones del nodo' })).toBeNull();
});

test('enables the complete editing capability only for an editable teaching projection', () => {
  const editing = editingCapability();
  render(
    <RoadmapGraph
      projection={{ kind: 'teaching', roadmap: teacherRoadmap, editing }}
      {...commonProps}
    />,
  );

  expect(screen.getByRole('button', { name: 'Ordenar horizontalmente' })).toBeTruthy();
  expect(screen.getAllByRole('button', { name: 'Abrir menú de acciones del nodo' })).toHaveLength(
    2,
  );
});
