export type Point = [number, number];

const traceRadius = 8;

function toward([x, y]: Point, [tx, ty]: Point, distance: number) {
  const length = Math.hypot(tx - x, ty - y);
  return `${x + ((tx - x) / length) * distance} ${y + ((ty - y) / length) * distance}`;
}

export function roundedPath(points: Point[]) {
  const corners = points.filter(
    (point, index) =>
      index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1],
  );
  const segments = [`M ${corners[0][0]} ${corners[0][1]}`];
  for (let index = 1; index < corners.length - 1; index++) {
    const [previous, corner, next] = [corners[index - 1], corners[index], corners[index + 1]];
    const radius = Math.min(
      traceRadius,
      Math.hypot(corner[0] - previous[0], corner[1] - previous[1]) / 2,
      Math.hypot(next[0] - corner[0], next[1] - corner[1]) / 2,
    );
    segments.push(
      `L ${toward(corner, previous, radius)}`,
      `Q ${corner[0]} ${corner[1]} ${toward(corner, next, radius)}`,
    );
  }
  const end = corners[corners.length - 1];
  segments.push(`L ${end[0]} ${end[1]}`);
  return segments.join(' ');
}
