import { act, render, screen } from '@testing-library/react';
import { motionValue } from 'motion/react';
import { afterEach, expect, it } from 'vitest';
import { DependencyPath } from '@/features/roadmap/graph/DependencyPath';

const originalLength = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getTotalLength');
const originalPoint = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getPointAtLength');
afterEach(() => {
  for (const [key, descriptor] of [
    ['getTotalLength', originalLength],
    ['getPointAtLength', originalPoint],
  ] as const) {
    if (descriptor) Object.defineProperty(SVGElement.prototype, key, descriptor);
    else Reflect.deleteProperty(SVGElement.prototype, key);
  }
});

it('reveals the stroke and moves its open tip from the same progress without another React render', () => {
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 100 },
    getPointAtLength: { configurable: true, value: (distance: number) => ({ x: distance, y: 20 }) },
  });
  const progress = motionValue(0);
  const view = render(
    <svg>
      <DependencyPath id="dependency" path="M 0 20 L 100 20" progress={progress} />
    </svg>,
  );
  // eslint-disable-next-line testing-library/no-node-access
  const stroke = document.getElementById('dependency')!;
  const tip = screen.getByTestId('dependency-arrowhead');
  expect(tip.style.visibility).toBe('hidden');

  act(() => progress.set(0.5));
  expect(stroke.getAttribute('stroke-dasharray')).toBe('0.5 1');
  expect(tip.getAttribute('transform')).toBe('translate(50 20) rotate(0)');
  expect(tip.style.visibility).toBe('visible');

  act(() => progress.set(1));
  expect(stroke.getAttribute('stroke-dasharray')).toBe('1 1');
  expect(tip.getAttribute('transform')).toBe('translate(100 20) rotate(0)');
  expect(tip.getAttribute('d')).toBe('M -9 -5 L 0 0 L -9 5');

  view.unmount();
  act(() => progress.set(0.25));
  expect(stroke.getAttribute('stroke-dasharray')).toBe('1 1');
});

it('orients the tip in the direction of a vertical path', () => {
  Object.defineProperties(SVGElement.prototype, {
    getTotalLength: { configurable: true, value: () => 100 },
    getPointAtLength: {
      configurable: true,
      value: (distance: number) => ({ x: 30, y: distance }),
    },
  });
  render(
    <svg>
      <DependencyPath path="M 30 0 L 30 100" />
    </svg>,
  );
  expect(screen.getByTestId('dependency-arrowhead').getAttribute('transform')).toBe(
    'translate(30 100) rotate(90)',
  );
});
