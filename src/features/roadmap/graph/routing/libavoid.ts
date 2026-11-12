import { preload } from 'react-dom';
import type {
  AvoidConnector,
  AvoidModule,
  AvoidPin,
  AvoidRouter,
  AvoidShape,
  NativeObject,
} from 'libavoid-js';
import { roadmapNodeDimensions, type Point } from '@/features/roadmap/graph/geometry';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import {
  dependencyRoute,
  fallbackDependencyRoute,
  type DependencyRoute,
  type RoutingObstacle,
} from './path';

export type RoutingDependency = { id: string; source: string; target: string };
export type RoutingScene = { obstacles: RoutingObstacle[]; dependencies: RoutingDependency[] };
export type RoutingResult = { routes: ReadonlyMap<string, DependencyRoute>; fallbacks: number };

const statusBadgeSize = 44;
const resourcesBadgeWidth = 52;

export function roadmapRoutingScene(
  nodes: readonly RoadmapFlowNode[],
  edges: readonly RoadmapFlowEdge[],
): RoutingScene {
  const obstacles: RoutingObstacle[] = [];
  const visible = new Set<string>();
  for (const node of nodes) {
    if (node.hidden) continue;
    visible.add(node.id);
    const { width, height } = roadmapNodeDimensions(node);
    const { x, y } = node.position;
    const add = (
      suffix: string,
      rect: { x: number; y: number; width: number; height: number },
      body = false,
    ) => obstacles.push({ id: `${node.id}:${suffix}`, nodeId: node.id, body, ...rect });
    add('body', { x, y, width, height }, true);
    add('status', {
      x: x + width - statusBadgeSize + 10,
      y: y + height - statusBadgeSize + 10,
      width: statusBadgeSize,
      height: statusBadgeSize,
    });
    add('resources', {
      x: x + width - resourcesBadgeWidth + 10,
      y: y - 10,
      width: resourcesBadgeWidth,
      height: 26,
    });
    add('notices', { x: x - 10, y: y - 10, width: 40, height: 24 });
  }
  return {
    obstacles,
    dependencies: edges
      .filter((edge) => !edge.hidden && visible.has(edge.source) && visible.has(edge.target))
      .map(({ id, source, target }) => ({ id, source, target })),
  };
}

const routingWasmUrl = '/vendor/libavoid/0.4.5/libavoid.wasm';

let modulePromise: Promise<AvoidModule> | undefined;
export function loadRoutingModule(): Promise<AvoidModule> {
  if (modulePromise) return modulePromise;
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new DOMException('Routing engine load timed out', 'TimeoutError'));
    }, 30_000);
  });
  const loading = import('libavoid-js').then(async ({ AvoidLib }) => {
    await AvoidLib.load(routingWasmUrl);
    return AvoidLib.getInstance();
  });
  const attempt = Promise.race([loading, deadline])
    .catch((error: unknown) => {
      if (modulePromise === attempt) modulePromise = undefined;
      throw error;
    })
    .finally(() => clearTimeout(timeout));
  modulePromise = attempt;
  return attempt;
}

export function prepareRoutingEngine() {
  preload(routingWasmUrl, { as: 'fetch', crossOrigin: 'anonymous' });
  if (typeof window !== 'undefined') loadRoutingModule().catch(() => {});
}

function compareDependencies(a: RoutingDependency, b: RoutingDependency) {
  return a.source.localeCompare(b.source) || a.target.localeCompare(b.target);
}

const dependencySpacing = 8;

type ShapeEntry = { obstacle: RoutingObstacle; shape: AvoidShape; pins: AvoidPin[] };
type ConnectorEntry = { dependency: RoutingDependency; connector: AvoidConnector };
type Port = {
  entry: ConnectorEntry;
  source: boolean;
  shape: ShapeEntry;
  side: number;
  point: Point;
  opposite: Point;
  bend: number;
  reach: number;
  groupSize: number;
};

export class DependencyRouter {
  private router: AvoidRouter | null = null;
  private readonly shapes = new Map<string, ShapeEntry>();
  private readonly connectors = new Map<string, ConnectorEntry>();
  private disposed = false;

  constructor(private readonly avoid: AvoidModule) {}

  private createRouter() {
    const router = new this.avoid.Router(this.avoid.OrthogonalRouting);
    router.setRoutingParameter(this.avoid.shapeBufferDistance, 12);
    router.setRoutingParameter(this.avoid.segmentPenalty, 24);
    router.setRoutingParameter(this.avoid.idealNudgingDistance, dependencySpacing);
    router.setRoutingOption(this.avoid.nudgeSharedPathsWithCommonEndPoint, true);
    return router;
  }

  private forget(object: NativeObject) {
    delete this.avoid.getCache(object.__class__)[this.avoid.getPointer(object)];
  }

  private polygon(rect: RoutingObstacle) {
    const a = new this.avoid.Point(rect.x, rect.y);
    const b = new this.avoid.Point(rect.x + rect.width, rect.y + rect.height);
    const polygon = new this.avoid.Rectangle(a, b);
    this.avoid.destroy(a);
    this.avoid.destroy(b);
    return polygon;
  }

  route(input: RoutingScene): RoutingResult {
    if (this.disposed) throw new Error('Dependency router has been disposed');
    this.releaseScene();
    const router = this.createRouter();
    this.router = router;
    const scene: RoutingScene = {
      obstacles: [...input.obstacles].sort(
        (a, b) =>
          a.nodeId.localeCompare(b.nodeId) ||
          Number(b.body) - Number(a.body) ||
          a.id.localeCompare(b.id),
      ),
      dependencies: [...input.dependencies].sort(compareDependencies),
    };
    for (const obstacle of scene.obstacles) {
      const polygon = this.polygon(obstacle);
      const shape = new this.avoid.ShapeRef(router, polygon);
      this.avoid.destroy(polygon);
      const pins: AvoidPin[] = [];
      if (obstacle.body) {
        for (const [x, y, direction] of [
          [0.5, 0, this.avoid.ConnDirUp],
          [1, 0.5, this.avoid.ConnDirRight],
          [0.5, 1, this.avoid.ConnDirDown],
          [0, 0.5, this.avoid.ConnDirLeft],
        ]) {
          const pin = new this.avoid.ShapeConnectionPin(shape, 1, x, y, true, 0, direction);
          pin.setExclusive(false);
          pins.push(pin);
        }
      }
      this.shapes.set(obstacle.id, { shape, pins, obstacle });
    }
    for (const dependency of scene.dependencies) {
      const source = this.shapes.get(`${dependency.source}:body`);
      const target = this.shapes.get(`${dependency.target}:body`);
      if (!source || !target) continue;
      const start = new this.avoid.ConnEnd(source.shape, 1);
      const end = new this.avoid.ConnEnd(target.shape, 1);
      const connector = new this.avoid.ConnRef(router, start, end);
      connector.setRoutingType(this.avoid.ConnType_Orthogonal);
      this.avoid.destroy(start);
      this.avoid.destroy(end);
      this.connectors.set(dependency.id, { dependency, connector });
    }
    router.processTransaction();
    const initial = new Map(
      [...this.connectors].map(([id, entry]) => [id, this.points(entry.connector)]),
    );
    const adjusted = this.routePorts(scene, this.ports(initial));
    const routes = new Map<string, DependencyRoute>();
    let fallbacks = 0;
    for (const [id, { dependency }] of this.connectors) {
      const points = adjusted.get(id) ?? initial.get(id)!;
      const route =
        dependencyRoute(points, dependency.source, dependency.target, scene.obstacles) ??
        dependencyRoute(initial.get(id)!, dependency.source, dependency.target, scene.obstacles);
      if (route) {
        routes.set(id, route);
        continue;
      }
      fallbacks++;
      const fallback =
        dependencyRoute(initial.get(id)!, dependency.source, dependency.target, []) ??
        fallbackDependencyRoute(
          this.shapes.get(`${dependency.source}:body`)!.obstacle,
          this.shapes.get(`${dependency.target}:body`)!.obstacle,
        );
      if (fallback) routes.set(id, fallback);
    }
    return { routes, fallbacks };
  }

  private routePorts(scene: RoutingScene, ports: readonly Port[]): Map<string, Point[]> {
    const router = this.createRouter();
    const owned: NativeObject[] = [];
    const shapes = new Map<string, AvoidShape>();
    const endpoints = new Map<string, { source?: Port; target?: Port }>();
    const pinIds = new Map<Port, number>();
    const connectors = new Map<string, AvoidConnector>();
    try {
      for (const obstacle of scene.obstacles) {
        const polygon = this.polygon(obstacle);
        const shape = new this.avoid.ShapeRef(router, polygon);
        this.avoid.destroy(polygon);
        owned.push(shape);
        shapes.set(obstacle.id, shape);
      }
      const pinsByPlace = new Map<string, number>();
      ports.forEach((port) => {
        const { obstacle } = port.shape;
        const place = `${obstacle.id}:${port.side}:${port.source}:${port.point.x},${port.point.y}`;
        const pair = endpoints.get(port.entry.dependency.id) ?? {};
        pair[port.source ? 'source' : 'target'] = port;
        endpoints.set(port.entry.dependency.id, pair);
        const shared = pinsByPlace.get(place);
        if (shared) {
          pinIds.set(port, shared);
          return;
        }
        const id = pinsByPlace.size + 1;
        pinsByPlace.set(place, id);
        pinIds.set(port, id);
        const directions = [
          this.avoid.ConnDirUp,
          this.avoid.ConnDirRight,
          this.avoid.ConnDirDown,
          this.avoid.ConnDirLeft,
        ];
        const pin = new this.avoid.ShapeConnectionPin(
          shapes.get(obstacle.id)!,
          id,
          port.point.x - obstacle.x,
          port.point.y - obstacle.y,
          false,
          0,
          directions[port.side],
        );
        pin.setExclusive(false);
        owned.push(pin);
      });
      for (const dependency of scene.dependencies) {
        const pair = endpoints.get(dependency.id);
        if (!pair?.source || !pair.target) continue;
        const start = new this.avoid.ConnEnd(
          shapes.get(`${dependency.source}:body`)!,
          pinIds.get(pair.source)!,
        );
        const end = new this.avoid.ConnEnd(
          shapes.get(`${dependency.target}:body`)!,
          pinIds.get(pair.target)!,
        );
        const connector = new this.avoid.ConnRef(router, start, end);
        connector.setRoutingType(this.avoid.ConnType_Orthogonal);
        this.avoid.destroy(start);
        this.avoid.destroy(end);
        owned.push(connector);
        connectors.set(dependency.id, connector);
      }
      router.processTransaction();
      const routes = new Map<string, Point[]>();
      for (const [id, connector] of connectors) {
        const points = this.points(connector);
        const pair = endpoints.get(id)!;
        const matches = (actual: Point | undefined, expected: Point) =>
          actual &&
          Math.abs(actual.x - expected.x) < 1e-6 &&
          Math.abs(actual.y - expected.y) < 1e-6;
        if (matches(points[0], pair.source!.point) && matches(points.at(-1), pair.target!.point))
          routes.set(id, points);
      }
      return routes;
    } finally {
      for (const object of owned) this.forget(object);
      this.avoid.destroy(router);
    }
  }

  private points(connector: AvoidConnector): Point[] {
    const native = connector.displayRoute();
    const points: Point[] = [];
    for (let i = 0; i < native.size(); i++) {
      const point = native.get_ps(i);
      points.push({ x: point.x, y: point.y });
      this.forget(point);
    }
    this.forget(native);
    return points;
  }

  private ports(routes: ReadonlyMap<string, readonly Point[]>): Port[] {
    const groups = new Map<string, Port[]>();
    const pairs: Port[][] = [];
    for (const [id, entry] of this.connectors) {
      const points = routes.get(id)!;
      if (points.length < 2) continue;
      const pair: Port[] = [];
      for (const source of [true, false]) {
        const nodeId = source ? entry.dependency.source : entry.dependency.target;
        const shape = this.shapes.get(`${nodeId}:body`)!;
        const point = { ...(source ? points[0] : points[points.length - 1]) };
        const neighbor = source ? points[1] : points[points.length - 2];
        const following = source ? points[2] : points[points.length - 3];
        const side =
          neighbor.y < point.y ? 0 : neighbor.x > point.x ? 1 : neighbor.y > point.y ? 2 : 3;
        const axis = side % 2 === 1 ? 'y' : 'x';
        const reach = Math.abs(neighbor.x - point.x) + Math.abs(neighbor.y - point.y);
        const bend = following ? Math.sign(following[axis] - neighbor[axis]) : 0;
        const port: Port = {
          entry,
          source,
          shape,
          side,
          point,
          opposite: source ? points[points.length - 1] : points[0],
          bend,
          reach,
          groupSize: 1,
        };
        const key = `${nodeId}:${side}:${source ? 'outgoing' : 'incoming'}`;
        const group = groups.get(key) ?? [];
        group.push(port);
        groups.set(key, group);
        pair.push(port);
      }
      pairs.push(pair);
    }
    for (const group of groups.values()) {
      const verticalSide = group[0].side % 2 === 1;
      const axis = verticalSide ? 'y' : 'x';
      const rect = group[0].shape.obstacle;
      const length = verticalSide ? rect.height : rect.width;
      const center = rect[axis] + length / 2;
      const spacing = group[0].source
        ? Math.min(dependencySpacing, Math.max(0, length - 24) / Math.max(1, group.length - 1))
        : 0;
      group.sort(
        (a, b) =>
          a.bend - b.bend ||
          (b.reach - a.reach) * a.bend ||
          a.opposite[axis] - b.opposite[axis] ||
          compareDependencies(a.entry.dependency, b.entry.dependency) ||
          Number(a.source) - Number(b.source),
      );
      group.forEach((port, index) => {
        port.point[axis] = center + (index - (group.length - 1) / 2) * spacing;
        port.groupSize = group.length;
      });
    }
    for (const [start, end] of pairs) {
      if ((start.side + 2) % 4 !== end.side || start.groupSize !== 1) continue;
      const axis = start.side % 2 === 1 ? 'y' : 'x';
      if (Math.abs(start.point[axis] - end.point[axis]) <= 5) start.point[axis] = end.point[axis];
    }
    return [...groups.values()].flat();
  }

  private releaseScene() {
    if (!this.router) return;
    for (const { connector } of this.connectors.values()) this.forget(connector);
    for (const { shape, pins } of this.shapes.values()) {
      pins.forEach((pin) => this.forget(pin));
      this.forget(shape);
    }
    this.avoid.destroy(this.router);
    this.router = null;
    this.connectors.clear();
    this.shapes.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.releaseScene();
    this.disposed = true;
  }
}
