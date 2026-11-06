import { describe, expect, it } from 'vitest';
import {
  dependencyAnimationSchedule,
  dependencyDrawingEase,
  dependencyDrawingVelocity,
} from '@/features/roadmap/graph/dependency-animation-schedule';

const edge = (source: string, target: string) => ({ id: `${source}-${target}`, source, target });

describe('Dependency entry animation', () => {
  it('starts the Bézier draw slowly and increases its speed smoothly to the endpoint', () => {
    const positions = Array.from({ length: 21 }, (_, index) => dependencyDrawingEase(index / 20));
    expect(positions[0]).toBe(0);
    expect(positions[positions.length - 1]).toBe(1);
    expect(dependencyDrawingEase(0.5)).toBeLessThan(0.4);
    const advances = positions.slice(1).map((position, index) => position - positions[index]);
    for (const advance of advances) expect(advance).toBeGreaterThan(0);
    for (let index = 1; index < advances.length; index++)
      expect(advances[index]).toBeGreaterThanOrEqual(advances[index - 1] - 0.00001);
    expect(advances[advances.length - 1]).toBeGreaterThan(advances[0] * 2);
  });

  it('makes velocity follow the Bézier profile by integrating it into displacement', () => {
    const step = 0.0001;
    const velocityAt = (time: number) =>
      (dependencyDrawingEase(time + step) - dependencyDrawingEase(time - step)) / (2 * step);
    const referenceSpeed = velocityAt(0.75);
    for (const time of [0.1, 0.25, 0.5, 0.9]) {
      expect(velocityAt(time) / referenceSpeed).toBeCloseTo(
        dependencyDrawingVelocity(time) / dependencyDrawingVelocity(0.75),
        2,
      );
    }
  });

  it('finishes every incoming prerequisite before drawing outgoing dependencies at a join', () => {
    const schedule = dependencyAnimationSchedule([
      edge('join', 'end'),
      edge('right', 'join'),
      edge('root', 'left'),
      edge('root', 'right'),
      edge('left', 'join'),
    ]);
    const slots = new Map(schedule.map((slot) => [slot.id, slot]));
    for (const incoming of ['left-join', 'right-join']) {
      const slot = slots.get(incoming)!;
      expect(slot.start + slot.duration).toBeLessThanOrEqual(slots.get('join-end')!.start);
    }
    for (let index = 1; index < schedule.length; index++) {
      const previous = schedule[index - 1];
      expect(schedule[index].start).toBeCloseTo(previous.start + previous.duration);
    }
  });

  it('keeps a large roadmap within two seconds while progressively increasing the cadence', () => {
    const schedule = dependencyAnimationSchedule(
      Array.from({ length: 200 }, (_, index) => edge(`n${index}`, `n${index + 1}`)),
    );
    const last = schedule[schedule.length - 1];
    expect(schedule).toHaveLength(200);
    expect(last.start + last.duration).toBeCloseTo(2);
    for (let index = 1; index < schedule.length; index++) {
      expect(schedule[index].duration).toBeGreaterThan(0);
      expect(schedule[index].duration).toBeLessThan(schedule[index - 1].duration);
    }
  });

  it('does not draw hidden dependencies or create a pause for an empty roadmap', () => {
    expect(dependencyAnimationSchedule([])).toEqual([]);
    const schedule = dependencyAnimationSchedule([
      { ...edge('hidden', 'target'), hidden: true },
      edge('visible', 'target'),
    ]);
    expect(schedule).toEqual([{ id: 'visible-target', start: 0, duration: 0.32 }]);
  });
});
