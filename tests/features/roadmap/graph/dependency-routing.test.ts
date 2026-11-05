// @vitest-environment node
import { resolve } from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { AvoidLib } from 'libavoid-js';
import {
  DependencyRouter,
  roadmapRoutingScene,
  type RoutingScene,
} from '@/features/roadmap/graph/routing/libavoid';
import { dependencyRoute, intersectsRect } from '@/features/roadmap/graph/routing/path';
import type { RoadmapFlowNode } from '@/features/roadmap/graph/RoadmapNode';

beforeAll(async () => {
  await AvoidLib.load(resolve('node_modules/libavoid-js/dist/libavoid.wasm'));
});

function body(id: string, x: number, y: number, width = 120, height = 80) {
  return { id: `${id}:body`, nodeId: id, body: true, x, y, width, height };
}

function scene(): RoutingScene {
  return {
    obstacles: [body('a', 0, 0), body('b', 600, 0), body('middle', 280, -40, 140, 160)],
    dependencies: [{ id: 'ab', source: 'a', target: 'b' }],
  };
}

function withRouter(run: (router: DependencyRouter) => void) {
  const router = new DependencyRouter(AvoidLib.getInstance());
  try {
    run(router);
  } finally {
    router.dispose();
  }
}

test('routes around an unrelated node with real WASM, keeping rounded corners and the arrow at its target', () => {
  withRouter((router) => {
    const input = scene();
    const { routes, blocked } = router.route(input);
    const route = routes.get('ab')!;
    expect(blocked).toBe(0);
    expect(route.path).toContain('Q');
    expect(route.points.length).toBeGreaterThan(2);
    for (let i = 1; i < route.points.length; i++) {
      expect(intersectsRect(route.points[i - 1], route.points[i], input.obstacles[2], 2)).toBe(
        false,
      );
    }
    const last = route.points.at(-1)!;
    expect(last.x === 600 || last.x === 720 || last.y === 0 || last.y === 80).toBe(true);
  });
});

test('moving a third node invalidates a formerly clear dependency without changing its endpoints', () => {
  withRouter((router) => {
    const input = scene();
    input.obstacles[2].y = 400;
    const before = router.route(input).routes.get('ab')!;
    input.obstacles[2] = { ...input.obstacles[2], y: -40 };
    const after = router.route(input).routes.get('ab')!;
    expect(before.path).not.toBe(after.path);
    expect(
      after.points
        .slice(1)
        .every((p, i) => !intersectsRect(after.points[i], p, input.obstacles[2], 2)),
    ).toBe(true);
    input.obstacles.pop();
    const removed = router.route(input).routes.get('ab')!;
    expect(removed.path).not.toBe(after.path);
  });
});

test('coordinates parallel dependencies rather than leaving their intermediate segments coincident', () => {
  withRouter((router) => {
    const input = scene();
    input.obstacles.push(body('c', 600, 160));
    input.dependencies.push({ id: 'ac', source: 'a', target: 'c' });
    const { routes, blocked } = router.route(input);
    expect(blocked).toBe(0);
    const first = routes.get('ab')!.points;
    const second = routes.get('ac')!.points;
    const shared = first
      .slice(1)
      .flatMap((end, i) =>
        second
          .slice(1)
          .filter(
            (otherEnd, j) =>
              i > 0 &&
              j > 0 &&
              i < first.length - 2 &&
              j < second.length - 2 &&
              first[i].y === end.y &&
              second[j].y === otherEnd.y &&
              end.y === otherEnd.y &&
              Math.min(Math.max(first[i].x, end.x), Math.max(second[j].x, otherEnd.x)) >
                Math.max(Math.min(first[i].x, end.x), Math.min(second[j].x, otherEnd.x)),
          ),
      );
    expect(shared).toHaveLength(0);
  });
});

test('reports impossible overlapping endpoints instead of falling back to a line through a node', () => {
  withRouter((router) => {
    const input = scene();
    input.obstacles[2] = body('middle', -20, -20, 160, 120);
    const result = router.route(input);
    expect(result.routes.has('ab')).toBe(false);
    expect(result.blocked).toBe(1);
  });
});

test('updates sizes, retargets and removes dependencies, and releases a scene idempotently', () => {
  withRouter((router) => {
    const input = scene();
    const old = router.route(input).routes.get('ab')!.path;
    input.obstacles[1] = { ...input.obstacles[1], x: -400, width: 200 };
    expect(router.route(input).routes.get('ab')!.path).not.toBe(old);
    input.dependencies[0] = { id: 'ab', source: 'b', target: 'a' };
    expect(router.route(input).routes.size).toBe(1);
    input.dependencies = [];
    input.obstacles = [];
    expect(router.route(input)).toEqual({ routes: new Map(), blocked: 0 });
    router.dispose();
    router.dispose();
  });
});

test('includes persistent ornaments, ignores hidden nodes and keeps selection out of routing geometry', () => {
  const node: RoadmapFlowNode = {
    id: 'a',
    type: 'roadmap',
    position: { x: 0, y: 0 },
    data: {
      title: 'A',
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isHidden: false,
      isTeacherBlocked: false,
      fileCount: 1,
      notificationsEnabled: true,
      canManageActions: true,
    },
  };
  const input = roadmapRoutingScene([node, { ...node, id: 'hidden', hidden: true }], []);
  expect(input.obstacles.map((o) => o.id)).toEqual([
    'a:body',
    'a:status',
    'a:resources',
    'a:notices',
  ]);
  const twoResourceGroups = roadmapRoutingScene(
    [{ ...node, data: { ...node.data, linkCount: 1 } }],
    [],
  );
  expect(twoResourceGroups.obstacles.find((o) => o.id === 'a:resources')!.width).toBe(52);
  expect(
    roadmapRoutingScene(
      [{ ...node, selected: true, data: { ...node.data, isActionMenuOpen: true } }],
      [],
    ),
  ).toEqual(input);
  withRouter((router) => {
    const input = roadmapRoutingScene(
      [node, { ...node, id: 'b', position: { x: 500, y: 0 } }],
      [{ id: 'ab', source: 'a', target: 'b' }],
    );
    expect(router.route(input).blocked).toBe(0);
  });
});

test('rejects the native smoothstep counterexample and protects rounded corners near an obstacle', () => {
  const obstacles = [body('middle', 90, 75, 20, 10)];
  expect(
    dependencyRoute(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ],
      'a',
      'b',
      obstacles,
    ),
  ).toBeNull();
  const route = dependencyRoute(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    'a',
    'b',
    [body('middle', 92, 4, 4, 4)],
  );
  expect(route).not.toBeNull();
  expect(route!.path).not.toContain('L92,0Q100,0 100,8');
});

test('keeps every dependency routable in the supplied screenshot topology', () => {
  const nodes: RoadmapFlowNode[] = [
    ['intro', 'Presentación reglas del curso', 0, 200],
    ['42', '4 2', 360, 80],
    ['62', '6 2', 360, 320],
    ['51', '5 1', 560, 340],
    ['eval51', 'eval 5 1', 80, 0],
    ['eval42', 'eval 4 2', 720, 80],
    ['final', 'eval final curso', 740, 320],
  ].map(([id, title, x, y]) => ({
    id: String(id),
    type: 'roadmap',
    position: { x: Number(x), y: Number(y) },
    data: {
      title: String(title),
      typeColor: '#024AD8',
      typeName: 'Contenido',
      typeIcon: 'BookOpen',
      status: 'editing',
      isHidden: false,
      isTeacherBlocked: false,
      canManageActions: true,
    },
  }));
  const pairs = [
    ['intro', '42'],
    ['intro', '62'],
    ['42', 'eval42'],
    ['62', 'eval51'],
    ['eval51', '51'],
    ['51', 'final'],
    ['eval42', 'final'],
  ];
  const input = roadmapRoutingScene(
    nodes,
    pairs.map(([source, target], i) => ({ id: String(i), source, target })),
  );
  withRouter((router) => {
    expect(router.route(input).blocked).toBe(0);
    expect(router.route(input).routes.size).toBe(pairs.length);
  });
});
