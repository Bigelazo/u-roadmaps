import { cubicBezier } from 'motion';

type DependencyRoute = { id: string; source: string; target: string; hidden?: boolean };

const roadmapEntranceBudgetSeconds = 1;
export const nodeRevealSeconds = 0.18;
const dependencyDrawSeconds = 0.32;

export type DependencyAnimationSlot = {
  id: string;
  start: number;
  duration: number;
};

export function dependencyAnimationSchedule(
  dependencies: readonly DependencyRoute[],
): DependencyAnimationSlot[] {
  const edges = dependencies.filter((edge) => !edge.hidden);
  const outgoing = new Map<string, DependencyRoute[]>();
  const indegree = new Map<string, number>();
  for (const edge of edges) {
    const siblings = outgoing.get(edge.source) ?? [];
    siblings.push(edge);
    outgoing.set(edge.source, siblings);
    indegree.set(edge.source, indegree.get(edge.source) ?? 0);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }
  const ready = [...indegree.keys()].filter((id) => indegree.get(id) === 0).sort();
  const ordered: DependencyRoute[] = [];
  for (let index = 0; index < ready.length; index++) {
    const siblings = outgoing.get(ready[index]) ?? [];
    siblings.sort((a, b) => a.target.localeCompare(b.target) || a.id.localeCompare(b.id));
    for (const edge of siblings) {
      ordered.push(edge);
      const remaining = (indegree.get(edge.target) ?? 0) - 1;
      indegree.set(edge.target, remaining);
      if (remaining === 0) ready.push(edge.target);
    }
  }
  const orderedIds = new Set(ordered.map((edge) => edge.id));
  ordered.push(...edges.filter((edge) => !orderedIds.has(edge.id)));

  const count = ordered.length;
  const total = Math.min(
    roadmapEntranceBudgetSeconds - nodeRevealSeconds,
    count * dependencyDrawSeconds,
  );
  const weight = (index: number) => (count < 2 ? 1 : 0.65 + (0.35 * index) / (count - 1));
  const weights = ordered.reduce((sum, _edge, index) => sum + weight(index), 0);
  let start = 0;
  return ordered.map((edge, index) => {
    const duration = (total * weight(index)) / weights;
    const slot = { id: edge.id, start, duration };
    start += duration;
    return slot;
  });
}

export const dependencyDrawingVelocity = cubicBezier(0.42, 0, 1, 1);

export const roadmapEntranceCadence = cubicBezier(0, 0, 0.58, 1);

const velocitySamples = 256;
const distances = [0];
for (let index = 1; index <= velocitySamples; index++) {
  distances.push(
    distances[index - 1] +
      (dependencyDrawingVelocity((index - 1) / velocitySamples) +
        dependencyDrawingVelocity(index / velocitySamples)) /
        (2 * velocitySamples),
  );
}
const totalDistance = distances[velocitySamples];

export function dependencyDrawingEase(time: number): number {
  const sample = Math.max(0, Math.min(1, time)) * velocitySamples;
  const index = Math.min(Math.floor(sample), velocitySamples - 1);
  return (
    (distances[index] + (distances[index + 1] - distances[index]) * (sample - index)) /
    totalDistance
  );
}
