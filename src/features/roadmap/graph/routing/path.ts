import type { NodeRect, Point } from '@/features/roadmap/graph/geometry';

export type RoutingObstacle = NodeRect & { id: string; nodeId: string; body: boolean };
export type DependencyRoute = {
  path: string;
  points: readonly Point[];
  label: Point;
};

const strokeClearance = 2;

export function intersectsRect(a: Point, b: Point, rect: NodeRect, margin = 0) {
  const left = rect.x - margin;
  const right = rect.x + rect.width + margin;
  const top = rect.y - margin;
  const bottom = rect.y + rect.height + margin;
  if (a.x === b.x) {
    return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom;
  }
  if (a.y === b.y) {
    return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right;
  }
  return true;
}

function overlaps(a: NodeRect, b: NodeRect, margin = 0) {
  return (
    a.x < b.x + b.width + margin &&
    a.x + a.width > b.x - margin &&
    a.y < b.y + b.height + margin &&
    a.y + a.height > b.y - margin
  );
}

function pointBefore(corner: Point, neighbor: Point, distance: number): Point {
  const length = Math.abs(corner.x - neighbor.x) + Math.abs(corner.y - neighbor.y);
  return {
    x: corner.x + ((neighbor.x - corner.x) / length) * distance,
    y: corner.y + ((neighbor.y - corner.y) / length) * distance,
  };
}

function curveIsClear(a: Point, corner: Point, b: Point, obstacles: readonly RoutingObstacle[]) {
  const box = {
    x: Math.min(a.x, corner.x, b.x),
    y: Math.min(a.y, corner.y, b.y),
    width: Math.max(a.x, corner.x, b.x) - Math.min(a.x, corner.x, b.x),
    height: Math.max(a.y, corner.y, b.y) - Math.min(a.y, corner.y, b.y),
  };
  return obstacles.every((obstacle) => !overlaps(box, obstacle, strokeClearance));
}

function routeLabel(points: readonly Point[], obstacles: readonly RoutingObstacle[]): Point {
  const segments = points
    .slice(1)
    .map((end, i) => ({
      start: points[i],
      end,
      length: Math.abs(end.x - points[i].x) + Math.abs(end.y - points[i].y),
    }))
    .sort((a, b) => b.length - a.length);
  for (const { start, end } of segments) {
    const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    for (const offset of [0, 24, -24, 48, -48]) {
      const candidate = {
        x: midpoint.x + (start.x === end.x ? offset : 0),
        y: midpoint.y + (start.y === end.y ? offset : 0),
      };
      if (
        obstacles.every(
          (obstacle) =>
            !overlaps(
              { x: candidate.x - 18, y: candidate.y - 18, width: 36, height: 36 },
              obstacle,
            ),
        )
      )
        return candidate;
    }
  }
  return points[0];
}

export function dependencyRoute(
  input: readonly Point[],
  source: string,
  target: string,
  obstacles: readonly RoutingObstacle[],
): DependencyRoute | null {
  const points = input.filter(
    (point, i) => !i || point.x !== input[i - 1].x || point.y !== input[i - 1].y,
  );
  if (points.length < 2 || points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return null;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x !== points[i - 1].x && points[i].y !== points[i - 1].y) return null;
    for (const obstacle of obstacles) {
      // Only terminal segments may touch their own node's boundary.
      if (
        obstacle.body &&
        ((i === 1 && obstacle.nodeId === source) ||
          (i === points.length - 1 && obstacle.nodeId === target))
      )
        continue;
      if (intersectsRect(points[i - 1], points[i], obstacle, strokeClearance)) return null;
    }
  }
  // The arrowhead fits in a conservative envelope behind the destination.
  const end = points[points.length - 1];
  const previous = points[points.length - 2];
  const arrow = pointBefore(
    end,
    previous,
    Math.min(14, Math.abs(end.x - previous.x) + Math.abs(end.y - previous.y)),
  );
  const arrowBox = {
    x: Math.min(end.x, arrow.x) - (end.x === arrow.x ? 6 : 0),
    y: Math.min(end.y, arrow.y) - (end.y === arrow.y ? 6 : 0),
    width: Math.abs(end.x - arrow.x) + (end.x === arrow.x ? 12 : 0),
    height: Math.abs(end.y - arrow.y) + (end.y === arrow.y ? 12 : 0),
  };
  if (obstacles.some((o) => !(o.body && o.nodeId === target) && overlaps(arrowBox, o))) return null;

  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1],
      corner = points[i],
      next = points[i + 1];
    let radius = Math.min(
      8,
      (Math.abs(previous.x - corner.x) + Math.abs(previous.y - corner.y)) / 2,
      (Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y)) / 2,
    );
    while (
      radius >= 1 &&
      !curveIsClear(
        pointBefore(corner, previous, radius),
        corner,
        pointBefore(corner, next, radius),
        obstacles,
      )
    )
      radius /= 2;
    if (radius < 1) path += `L${corner.x},${corner.y}`;
    else {
      const a = pointBefore(corner, previous, radius),
        b = pointBefore(corner, next, radius);
      path += `L${a.x},${a.y}Q${corner.x},${corner.y} ${b.x},${b.y}`;
    }
  }
  path += `L${end.x},${end.y}`;
  return { path, points, label: routeLabel(points, obstacles) };
}
