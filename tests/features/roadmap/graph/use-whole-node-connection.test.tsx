import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import type { Connection } from '@xyflow/react';
import { useWholeNodeConnection } from '@/features/roadmap/graph/use-whole-node-connection';
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
  edges = [],
  hiddenTarget = false,
  enabled = true,
}: {
  onConnect: (connection: Connection) => void;
  onOpen: () => void;
  edges?: RoadmapFlowEdge[];
  hiddenTarget?: boolean;
  enabled?: boolean;
}) {
  const connection = useWholeNodeConnection({
    nodes: [node('source'), node('target', hiddenTarget), node('middle')],
    edges,
    enabled,
    onConnect,
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
  { name: 'hidden destination', hiddenTarget: true, edges: [], enabled: true },
  { name: 'read-only canvas', hiddenTarget: false, edges: [], enabled: false },
  {
    name: 'duplicate',
    hiddenTarget: false,
    edges: [{ id: 'existing', source: 'source', target: 'target' }],
    enabled: true,
  },
  {
    name: 'transitive cycle',
    hiddenTarget: false,
    edges: [
      { id: 'first', source: 'target', target: 'middle' },
      { id: 'second', source: 'middle', target: 'source' },
    ],
    enabled: true,
  },
])('rejects a whole-Node drop for $name', async ({ hiddenTarget, edges, enabled }) => {
  const user = userEvent.setup();
  const onConnect = vi.fn();
  render(
    <Harness
      onConnect={onConnect}
      onOpen={vi.fn()}
      edges={edges}
      hiddenTarget={hiddenTarget}
      enabled={enabled}
    />,
  );
  await user.pointer([
    { target: screen.getByRole('button', { name: 'Handle de origen' }), keys: '[MouseLeft>]' },
    { target: screen.getByRole('button', { name: 'Título del destino' }) },
  ]);
  expect(screen.getByLabelText('Destino resaltado').textContent).toBe('');
  await user.pointer({ keys: '[/MouseLeft]' });
  expect(onConnect).not.toHaveBeenCalled();
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
