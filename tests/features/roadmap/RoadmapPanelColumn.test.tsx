import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { RoadmapPanelColumn } from '@/features/roadmap/ui/RoadmapPanelColumn';

function stubRunningTransition() {
  let finish = () => {};
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  stubTransitions([{ finished } as unknown as Animation]);
  return finish;
}

function stubTransitions(transitions: Animation[]) {
  Element.prototype.getAnimations = vi.fn(() => transitions);
}

function column(isOpen: boolean, content: string, width = 400, scene = 'roadmap') {
  return (
    <RoadmapPanelColumn isOpen={isOpen} width={width} scene={scene}>
      <p>{content}</p>
    </RoadmapPanelColumn>
  );
}

function columnElement() {
  return document.querySelector<HTMLElement>('[data-slot="roadmap-panel-column"]')!;
}

afterEach(() => {
  delete (Element.prototype as Partial<Element>).getAnimations;
});

test('keeps the open content and width, unreachable, until the closing transition finishes', async () => {
  const finish = stubRunningTransition();
  const { rerender } = render(column(true, 'Nodo abierto'));

  rerender(column(false, 'Sin nodo', 320));

  expect(screen.getByText('Nodo abierto')).toBeTruthy();
  expect(screen.queryByText('Sin nodo')).toBeNull();
  expect(columnElement().hasAttribute('inert')).toBe(true);
  expect(columnElement().style.getPropertyValue('--sidebar-width')).toBe('400px');

  await act(async () => finish());

  expect(screen.getByText('Sin nodo')).toBeTruthy();
  expect(screen.queryByText('Nodo abierto')).toBeNull();
  expect(columnElement().hasAttribute('inert')).toBe(false);
});

test('closes in the same commit when no transition runs', () => {
  stubTransitions([]);
  const { rerender } = render(column(true, 'Nodo abierto'));

  rerender(column(false, 'Sin nodo'));

  expect(screen.getByText('Sin nodo')).toBeTruthy();
  expect(columnElement().hasAttribute('inert')).toBe(false);
});

test('shows the current content again when reopened during the closing transition', async () => {
  const finish = stubRunningTransition();
  const { rerender } = render(column(true, 'Nodo abierto'));

  rerender(column(false, 'Sin nodo'));
  rerender(column(true, 'Otro nodo'));

  expect(screen.getByText('Otro nodo')).toBeTruthy();
  expect(columnElement().hasAttribute('inert')).toBe(false);

  await act(async () => finish());

  expect(screen.getByText('Otro nodo')).toBeTruthy();
});

test('settles the close when the transition is cancelled', async () => {
  const cancelled = Promise.reject(new DOMException('cancelled', 'AbortError'));
  stubTransitions([{ finished: cancelled } as unknown as Animation]);
  const { rerender } = render(column(true, 'Nodo abierto'));

  rerender(column(false, 'Sin nodo'));
  await act(async () => {
    await Promise.allSettled([cancelled]);
  });

  expect(screen.getByText('Sin nodo')).toBeTruthy();
});

test('closes in the same commit when the scene changes, even with a transition running', () => {
  stubRunningTransition();
  const { rerender } = render(column(true, 'Nodo abierto'));

  rerender(column(false, 'Sin nodo', 400, 'canvas-preview'));

  expect(screen.getByText('Sin nodo')).toBeTruthy();
  expect(columnElement().hasAttribute('inert')).toBe(false);
});

test('animates closing again once the new scene has settled', () => {
  stubRunningTransition();
  const { rerender } = render(column(true, 'Nodo abierto', 400, 'canvas-preview'));

  rerender(column(true, 'Nodo abierto', 400, 'roadmap'));
  rerender(column(false, 'Sin nodo', 400, 'roadmap'));

  expect(screen.getByText('Nodo abierto')).toBeTruthy();
  expect(columnElement().hasAttribute('inert')).toBe(true);
});
