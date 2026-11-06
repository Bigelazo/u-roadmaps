import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useWholeNodeConnection } from '@/features/roadmap/graph/use-whole-node-connection';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { Connection } from '@xyflow/react';

const originalHitTest = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
let hitTarget: Element | null;
const point = (x = 100) => ({ identifier: 1, clientX: x, clientY: 100 });
const touch = (x = 100) => ({ touches: [point(x)], changedTouches: [point(x)] });
const ended = (x = 100) => ({ touches: [], changedTouches: [point(x)] });

beforeEach(() => {
  vi.useFakeTimers();
  hitTarget = null;
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: () => hitTarget,
  });
});
afterEach(() => {
  vi.useRealTimers();
  if (originalHitTest) Object.defineProperty(document, 'elementFromPoint', originalHitTest);
  else Reflect.deleteProperty(document, 'elementFromPoint');
});

function Harness({
  onConnect,
  onOpen,
  onPan,
  enabled = true,
}: {
  onConnect: (connection: Connection) => void;
  onOpen: () => void;
  onPan?: () => void;
  enabled?: boolean;
}) {
  const nodes: RoadmapFlowNode[] = ['source', 'target'].map((id) => ({
    id,
    type: 'roadmap',
    position: { x: 0, y: 0 },
    data: {
      title: id,
      typeColor: 'blue',
      typeName: 'Contenido',
      typeIcon: 'book-open',
      status: 'editing',
      isHidden: false,
      isTeacherBlocked: false,
    },
  }));
  const connection = useWholeNodeConnection({ nodes, edges: [], enabled, onConnect });
  return (
    <div
      onTouchStartCapture={connection.onTouchStartCapture}
      onTouchMoveCapture={connection.onPointerMove}
      onTouchEndCapture={connection.onTouchEndCapture}
      onTouchCancelCapture={connection.onTouchCancelCapture}
      onClickCapture={connection.onClickCapture}
      onContextMenuCapture={connection.onContextMenuCapture}
      onTouchMove={onPan}
    >
      <div className="react-flow__node nopan" data-id="source">
        <span onClick={onOpen}>Cuerpo de origen</span>
        <button type="button" onClick={onOpen}>
          Recurso del origen
        </button>
      </div>
      <div className="react-flow__node nopan" data-id="target">
        <span onClick={onOpen}>Cuerpo de destino</span>
      </div>
      <div data-arrow-mode-controls>
        <button type="button" onClick={connection.cancelArrowMode}>
          Cancelar modo flecha
        </button>
      </div>
      <output aria-label="Origen en modo flecha">{connection.arrowSourceId}</output>
      <output aria-label="Aviso de modo flecha">{connection.arrowMessage}</output>
      <output aria-label="Destino resaltado">{connection.targetId}</output>
    </div>
  );
}

function beginLongPress() {
  const source = screen.getByText('Cuerpo de origen');
  hitTarget = source;
  fireEvent.touchStart(source, touch());
  act(() => vi.advanceTimersByTime(450));
  return source;
}

test('a touch long press arms arrow mode, release keeps it armed and a target tap connects without opening either Node', () => {
  const onConnect = vi.fn();
  const onOpen = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={onOpen} />);
  const source = beginLongPress();
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('source');
  expect(screen.getByLabelText('Aviso de modo flecha').textContent).toBe(
    'Modo flecha: toca un nodo de destino',
  );
  fireEvent.touchEnd(source, ended());
  fireEvent.click(source);
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('source');

  const target = screen.getByText('Cuerpo de destino');
  hitTarget = target;
  fireEvent.touchStart(target, touch());
  fireEvent.touchEnd(target, ended());
  fireEvent.click(target);
  expect(onConnect).toHaveBeenCalledExactlyOnceWith({
    source: 'source',
    target: 'target',
    sourceHandle: null,
    targetHandle: null,
  });
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  expect(onOpen).not.toHaveBeenCalled();
});

test('a continuous long press followed by a drag can connect using the touched coordinates', () => {
  const onConnect = vi.fn();
  const onPan = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={vi.fn()} onPan={onPan} />);
  const source = beginLongPress();
  hitTarget = screen.getByText('Cuerpo de destino');
  fireEvent.touchMove(source, touch(250));
  expect(screen.getByLabelText('Destino resaltado').textContent).toBe('target');
  expect(onPan).not.toHaveBeenCalled();
  fireEvent.touchEnd(source, ended(250));
  expect(onConnect).toHaveBeenCalledTimes(1);
});

test('movement before the dwell cancels arming and allows the ordinary pan or Node drag', () => {
  const onPan = vi.fn();
  const onOpen = vi.fn();
  const onConnect = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={onOpen} onPan={onPan} />);
  const source = screen.getByText('Cuerpo de origen');
  hitTarget = source;
  fireEvent.touchStart(source, touch());
  fireEvent.touchMove(source, touch(112));
  act(() => vi.advanceTimersByTime(600));
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  expect(onPan).toHaveBeenCalledTimes(1);
  fireEvent.touchEnd(source, ended(112));
  fireEvent.click(source);
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onConnect).not.toHaveBeenCalled();
});

test('ordinary touch taps and long presses on a resource control preserve their normal actions', () => {
  const onOpen = vi.fn();
  render(<Harness onConnect={vi.fn()} onOpen={onOpen} />);
  const source = screen.getByText('Cuerpo de origen');
  hitTarget = source;
  fireEvent.touchStart(source, touch());
  fireEvent.touchEnd(source, ended());
  fireEvent.click(source);
  const resource = screen.getByRole('button', { name: 'Recurso del origen' });
  hitTarget = resource;
  fireEvent.touchStart(resource, touch());
  act(() => vi.advanceTimersByTime(600));
  fireEvent.touchEnd(resource, ended());
  fireEvent.click(resource);
  expect(onOpen).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
});

test('invalid target selection keeps arrow mode, while Cancelar and touch cancellation exit it', () => {
  const onConnect = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={vi.fn()} />);
  const source = beginLongPress();
  fireEvent.touchEnd(source, ended());
  fireEvent.touchStart(source, touch());
  fireEvent.touchEnd(source, ended());
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('source');
  expect(screen.getByLabelText('Aviso de modo flecha').textContent).toMatch(/Elige otro nodo/);
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar modo flecha' }));
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  beginLongPress();
  fireEvent.touchCancel(source);
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  expect(onConnect).not.toHaveBeenCalled();
});

test('an outside touch cancels arrow mode and read-only Nodes cannot arm it', () => {
  const onConnect = vi.fn();
  const view = render(<Harness onConnect={onConnect} onOpen={vi.fn()} />);
  const source = beginLongPress();
  fireEvent.touchEnd(source, ended());
  hitTarget = null;
  fireEvent.touchStart(source, touch(300));
  fireEvent.touchEnd(source, ended(300));
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  view.rerender(<Harness onConnect={onConnect} onOpen={vi.fn()} enabled={false} />);
  beginLongPress();
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  expect(onConnect).not.toHaveBeenCalled();
});

test('Escape cancels touch arrow mode even when keyboard focus stays outside the canvas', () => {
  const onConnect = vi.fn();
  render(<Harness onConnect={onConnect} onOpen={vi.fn()} />);
  const source = beginLongPress();
  fireEvent.touchEnd(source, ended());
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('source');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByLabelText('Origen en modo flecha').textContent).toBe('');
  expect(onConnect).not.toHaveBeenCalled();
});
