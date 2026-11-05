import type { AvoidConnector, AvoidModule, AvoidPin, AvoidShape, NativeObject } from 'libavoid-js';
import { roadmapNodeSizeForTitle } from '@/features/roadmap/graph/geometry';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';
import type { RoadmapFlowEdge } from '@/features/roadmap/graph/DependencyEdge';
import { dependencyRoute, type DependencyRoute, type RoutingObstacle } from './path';

export type RoutingDependency = { id: string; source: string; target: string };
export type RoutingScene = { obstacles: RoutingObstacle[]; dependencies: RoutingDependency[] };
export type RoutingResult = { routes: ReadonlyMap<string, DependencyRoute>; blocked: number };

export function roadmapRoutingScene(
  nodes: readonly RoadmapFlowNode[],
  edges: readonly RoadmapFlowEdge[],
): RoutingScene {
  const obstacles: RoutingObstacle[] = [];
  const visible = new Set<string>();
  for (const node of nodes) {
    if (node.hidden) continue;
    visible.add(node.id);
    const { width, height } = roadmapNodeSizeForTitle(node.data.title);
    const { x, y } = node.position;
    const add = (
      suffix: string,
      rect: { x: number; y: number; width: number; height: number },
      body = false,
    ) => obstacles.push({ id: `${node.id}:${suffix}`, nodeId: node.id, body, ...rect });
    add('body', { x, y, width, height }, true);
    // Stable footprints include persistent corner controls, never transient menus.
    const actionSize = node.data.canManageActions && node.data.useActionSheet ? 44 : 32;
    add('status', {
      x: x + width - actionSize + 10,
      y: y + height - actionSize + 10,
      width: actionSize,
      height: actionSize,
    });
    if (node.data.fileCount || node.data.linkCount) {
      const resourceWidth = node.data.fileCount && node.data.linkCount ? 52 : 28;
      add('resources', {
        x: x + width - resourceWidth + 10,
        y: y - 10,
        width: resourceWidth,
        height: 26,
      });
    }
    if (node.data.notificationsEnabled && node.data.status !== 'locked') {
      add('notices', { x: x - 10, y: y - 10, width: 40, height: 24 });
    }
  }
  return {
    obstacles,
    dependencies: edges
      .filter((edge) => !edge.hidden && visible.has(edge.source) && visible.has(edge.target))
      .map(({ id, source, target }) => ({ id, source, target })),
  };
}

// The module is shared, native scenes are not. A rejected load can be retried.
let modulePromise: Promise<AvoidModule> | undefined;
export function loadRoutingModule(): Promise<AvoidModule> {
  return (modulePromise ??= import('libavoid-js')
    .then(async ({ AvoidLib }) => {
      await AvoidLib.load('/vendor/libavoid/0.4.5/libavoid.wasm');
      return AvoidLib.getInstance();
    })
    .catch((error: unknown) => {
      modulePromise = undefined;
      throw error;
    }));
}

type ShapeEntry = { obstacle: RoutingObstacle; shape: AvoidShape; pins: AvoidPin[] };
type ConnectorEntry = { dependency: RoutingDependency; connector: AvoidConnector };

export class DependencyRouter {
  private readonly router;
  private readonly shapes = new Map<string, ShapeEntry>();
  private readonly connectors = new Map<string, ConnectorEntry>();
  private disposed = false;

  constructor(private readonly avoid: AvoidModule) {
    this.router = new avoid.Router(avoid.OrthogonalRouting);
    this.router.setRoutingParameter(avoid.shapeBufferDistance, 12);
    this.router.setRoutingParameter(avoid.segmentPenalty, 24);
    this.router.setRoutingParameter(avoid.idealNudgingDistance, 8);
    this.router.setRoutingOption(avoid.nudgeSharedPathsWithCommonEndPoint, true);
  }

  private forget(object: NativeObject) {
    // Router owns shapes/pins/connectors; borrowed route points must not be freed.
    // Remove only their WebIDL wrapper cache entries after native ownership ends.
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

  private removeConnector(id: string, entry: ConnectorEntry) {
    this.router.deleteConnector(entry.connector);
    this.forget(entry.connector);
    this.connectors.delete(id);
  }

  route(scene: RoutingScene): RoutingResult {
    if (this.disposed) throw new Error('Dependency router has been disposed');
    const obstacleIds = new Set(scene.obstacles.map(({ id }) => id));
    const dependencies = new Map(
      scene.dependencies.map((dependency) => [dependency.id, dependency]),
    );
    for (const [id, entry] of this.connectors) {
      const next = dependencies.get(id);
      if (
        !next ||
        next.source !== entry.dependency.source ||
        next.target !== entry.dependency.target
      ) {
        this.removeConnector(id, entry);
      }
    }
    for (const [id, entry] of this.shapes) {
      if (obstacleIds.has(id)) continue;
      this.router.deleteShape(entry.shape);
      entry.pins.forEach((pin) => this.forget(pin));
      this.forget(entry.shape);
      this.shapes.delete(id);
    }
    for (const obstacle of scene.obstacles) {
      const entry = this.shapes.get(obstacle.id);
      if (entry) {
        const old = entry.obstacle;
        if (
          old.x !== obstacle.x ||
          old.y !== obstacle.y ||
          old.width !== obstacle.width ||
          old.height !== obstacle.height
        ) {
          const polygon = this.polygon(obstacle);
          this.router.moveShape(entry.shape, polygon);
          this.avoid.destroy(polygon);
          entry.obstacle = obstacle;
        }
        continue;
      }
      const polygon = this.polygon(obstacle);
      const shape = new this.avoid.ShapeRef(this.router, polygon);
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
      if (this.connectors.has(dependency.id)) continue;
      const source = this.shapes.get(`${dependency.source}:body`);
      const target = this.shapes.get(`${dependency.target}:body`);
      if (!source || !target) continue;
      const start = new this.avoid.ConnEnd(source.shape, 1);
      const end = new this.avoid.ConnEnd(target.shape, 1);
      const connector = new this.avoid.ConnRef(this.router, start, end);
      connector.setRoutingType(this.avoid.ConnType_Orthogonal);
      this.avoid.destroy(start);
      this.avoid.destroy(end);
      this.connectors.set(dependency.id, { dependency, connector });
    }
    this.router.processTransaction();
    const routes = new Map<string, DependencyRoute>();
    for (const [id, { dependency, connector }] of this.connectors) {
      const native = connector.displayRoute();
      const points = [];
      for (let i = 0; i < native.size(); i++) {
        const point = native.get_ps(i);
        points.push({ x: point.x, y: point.y });
        this.forget(point);
      }
      this.forget(native);
      const route = dependencyRoute(points, dependency.source, dependency.target, scene.obstacles);
      if (route) routes.set(id, route);
    }
    return { routes, blocked: scene.dependencies.length - routes.size };
  }

  dispose() {
    if (this.disposed) return;
    for (const { connector } of this.connectors.values()) this.forget(connector);
    for (const { shape, pins } of this.shapes.values()) {
      pins.forEach((pin) => this.forget(pin));
      this.forget(shape);
    }
    this.avoid.destroy(this.router);
    this.connectors.clear();
    this.shapes.clear();
    this.disposed = true;
  }
}
