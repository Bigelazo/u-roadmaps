import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { Connection } from '@xyflow/react';
import {
  useWholeNodeConnection,
  type ConnectionRejection,
} from '@/features/roadmap/graph/use-whole-node-connection';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';

function node(id: string, hidden = false): RoadmapFlowNode {
  return {
    id,
    type: 'roadmap',
    position: { x: 0, y: 0 },
    data: {
      title: id,
      typeColor: 'blue',
      typeName: 'Contenido',
      typeIcon: 'book-open',
      status: 'editing',
      isHidden: hidden,
      isTeacherBlocked: false,
    },
  };
}

function Harness({
  onConnect,
  onOpen,
  onReject = () => {},
  edges = [],
  hiddenTarget = false,
  enabled = true,
}: {
  onConnect: (connection: Connection) => void;
  onOpen: () => void;
  onReject?: (rejection: ConnectionRejection) => void;
  edges?: RoadmapFlowEdge[];
  hiddenTarget?: boolean;
  enabled?: boolean;
}) {
  const connection = useWholeNodeConnection({
    nodes: [node('source'), node('target', hiddenTarget), node('middle')],
    edges,
    enabled,
    onConnect,
    onReject,
  });
  return (
    <div
      onMouseMoveCapture={connection.onPointerMove}
      onMouseUp={(event) => connection.onConnectEnd(event.nativeEvent)}
      onClickCapture={connection.onClickCapture}
    >
      <div className="react-flow__node" data-id="source">
        <button
          type="button"
          onMouseDown={(event) =>
            connection.onConnectStart(event.nativeEvent, {
              nodeId: 'source',
              handleId: 'right',
              handleType: 'source',
            })
          }
        >
          Handle de origen
        </button>
      </div>
      <div className="react-flow__node" data-id="target">
        <button type="button" onClick={onOpen}>
          Título del destino
        </button>
        <button
          type="button"
          onMouseUp={() =>
            connection.onConnect({
              source: 'source',
              target: 'target',
              sourceHandle: 'right',
              targetHandle: 'left',
            })
          }
        >
          Handle del destino
        </button>
      </div>
      <button type="button">Canvas vacío</button>
      <output aria-label="Destino resaltado">{connection.targetId}</output>
      <output aria-label="Destino rechazado">{connection.rejectedTargetId}</output>
    </div>
  );
}

test('a handle-started drag targets the Node title, highlights it and emits one Dependency without opening the Node', async () => {
  const user = userEvent.setup();
  const onConnect = vi.fn();
  const onOpen = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={onOpen} />);
  await user.pointer({
    target: screen.getByRole('button', { name: 'Handle de origen' }),
    keys: '[MouseLeft>]',
  });
  await user.pointer({ target: screen.getByRole('button', { name: 'Título del destino' }) });
  expect(screen.getByLabelText('Destino resaltado').textContent).toBe('target');
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(onConnect).toHaveBeenCalledExactlyOnceWith({
    source: 'source',
    target: 'target',
    sourceHandle: 'right',
    targetHandle: null,
  });
  expect(onOpen).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Destino resaltado').textContent).toBe('');
});

test('the existing handle connection and whole-Node fallback do not emit the same Dependency twice', async () => {
  const user = userEvent.setup();
  const onConnect = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={vi.fn()} />);
  await user.pointer([
    { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
    { target: screen.getByRole('button', { name: 'Handle del destino' }) },
    { keys: '[/MouseLeft]' },
  ]);
  expect(onConnect).toHaveBeenCalledTimes(1);
  expect(onConnect.mock.calls[0][0].targetHandle).toBe('left');
});

test.each([
  {
    name: 'hidden destination',
    hiddenTarget: true,
    edges: [],
    reason: 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
  },
  {
    name: 'duplicate',
    hiddenTarget: false,
    edges: [{ id: 'existing', source: 'source', target: 'target' }],
    reason: 'DEPENDENCY_CONFLICT',
  },
  {
    name: 'transitive cycle',
    hiddenTarget: false,
    edges: [
      { id: 'first', source: 'target', target: 'middle' },
      { id: 'second', source: 'middle', target: 'source' },
    ],
    reason: 'DEPENDENCY_CYCLE',
  },
])(
  'marks the Node as rejected and reports why a whole-Node drop fails for $name',
  async ({ hiddenTarget, edges, reason }) => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    const onReject = vi.fn();
    render(
      <Harness
        onConnect={onConnect}
        onOpen={vi.fn()}
        onReject={onReject}
        edges={edges}
        hiddenTarget={hiddenTarget}
      />,
    );
    await user.pointer([
      { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
      { target: screen.getByRole('button', { name: 'Título del destino' }) },
    ]);
    expect(screen.getByLabelText('Destino resaltado').textContent).toBe('');
    expect(screen.getByLabelText('Destino rechazado').textContent).toBe('target');
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(onConnect).not.toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        reason,
        source: expect.objectContaining({ id: 'source' }),
        target: expect.objectContaining({ id: 'target' }),
      }),
    );
    expect(screen.getByLabelText('Destino rechazado').textContent).toBe('');
  },
);

test('a read-only canvas never starts a connection or reports a rejection', async () => {
  const user = userEvent.setup();
  const onConnect = vi.fn();
  const onReject = vi.fn();
  render(
    <Harness
      onConnect={onConnect}
      onOpen={vi.fn()}
      onReject={onReject}
      hiddenTarget
      enabled={false}
    />,
  );
  await user.pointer([
    { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
    { target: screen.getByRole('button', { name: 'Título del destino' }) },
    { keys: '[/MouseLeft]' },
  ]);
  expect(onConnect).not.toHaveBeenCalled();
  expect(onReject).not.toHaveBeenCalled();
});

test('dropping back on the source Node cancels without reporting a rejection', async () => {
  const user = userEvent.setup();
  const onReject = vi.fn();
  render(<Harness onConnect={vi.fn()} onOpen={vi.fn()} onReject={onReject} />);
  await user.pointer([
    { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
    { target: screen.getByRole('button', { name: 'Handle de origen' }) },
  ]);
  expect(screen.getByLabelText('Destino rechazado').textContent).toBe('');
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(onReject).not.toHaveBeenCalled();
});

test('an empty-canvas drop and an ordinary Node click do not create a Dependency', async () => {
  const user = userEvent.setup();
  const onConnect = vi.fn();
  const onOpen = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={onOpen} />);
  await user.pointer([
    { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
    { target: screen.getByRole('button', { name: 'Canvas vacío' }) },
    { keys: '[/MouseLeft]' },
  ]);
  await user.click(screen.getByRole('button', { name: 'Título del destino' }));
  expect(onConnect).not.toHaveBeenCalled();
  expect(onOpen).toHaveBeenCalledTimes(1);
});

test('the drop click cannot activate a target action button', () => {
  const onOpen = vi.fn();
  render(<Harness onConnect={vi.fn()} onOpen={onOpen} />);
  const target = screen.getByRole('button', { name: 'Título del destino' });
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Handle de origen' }));
  fireEvent.mouseUp(target);
  fireEvent.click(target);
  expect(onOpen).not.toHaveBeenCalled();
});
