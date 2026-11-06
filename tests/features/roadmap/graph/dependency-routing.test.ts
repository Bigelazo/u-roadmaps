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

test('keeps an aligned dependency straight when another dependency branches from its source', () => {
  withRouter((router) => {
    const result = router.route({
      obstacles: [body('a', 0, 0), body('b', 600, 0), body('c', 600, 160), body('d', 600, -160)],
      dependencies: [
        { id: 'ab', source: 'a', target: 'b' },
        { id: 'ac', source: 'a', target: 'c' },
        { id: 'ad', source: 'a', target: 'd' },
      ],
    });
    expect(result.blocked).toBe(0);
    expect(result.routes.get('ab')!.points).toEqual([
      { x: 120, y: 40 },
      { x: 600, y: 40 },
    ]);
  });
});

test('keeps near-aligned opposing ports straight instead of adding a three-pixel S bend', () => {
  withRouter((router) => {
    const result = router.route({
      obstacles: [body('a', 0, 0), body('b', 600, 3)],
      dependencies: [{ id: 'ab', source: 'a', target: 'b' }],
    });
    expect(result.blocked).toBe(0);
    const points = result.routes.get('ab')!.points;
    expect(new Set(points.map(({ y }) => y)).size).toBe(1);
    expect(points.at(-1)).toEqual({ x: 600, y: 43 });
  });
});

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

test.each(
  [0, 1, 2, 3].flatMap((turns) =>
    (['outgoing', 'incoming', 'mixed'] as const).map((mode) => ({ turns, mode })),
  ),
)(
  'distributes $mode ports on side $turns without separating incoming arrows',
  ({ turns, mode }) => {
    const rotate = ({ x, y }: { x: number; y: number }) => {
      for (let i = 0; i < turns; i++) [x, y] = [-y, x];
      return { x, y };
    };
    const obstacles = [
      body('hub', 0, 0),
      ...[10, 30, 50].map((y, i) => body(String(i), 600, y, 120, 20)),
    ].map((rect) => {
      const a = rotate(rect);
      const b = rotate({ x: rect.x + rect.width, y: rect.y + rect.height });
      return {
        ...rect,
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(a.x - b.x),
        height: Math.abs(a.y - b.y),
      };
    });
    withRouter((router) => {
      const input = {
        obstacles,
        dependencies: [0, 1, 2].map((i) => {
          const incoming = mode === 'incoming' || (mode === 'mixed' && i === 1);
          return {
            id: String(i),
            source: incoming ? String(i) : 'hub',
            target: incoming ? 'hub' : String(i),
          };
        }),
      };
      const result = router.route(input);
      expect(result.blocked).toBe(0);
      const actual = input.dependencies.map(({ id, source }) => {
        const points = result.routes.get(id)!.points;
        return source === 'hub' ? points[0] : points.at(-1);
      });
      const coordinates =
        mode === 'outgoing' ? [35, 40, 45] : mode === 'incoming' ? [40, 40, 40] : [37.5, 40, 42.5];
      expect(actual).toEqual(coordinates.map((y) => rotate({ x: 120, y })));
      const reordered = router.route({ ...input, dependencies: [...input.dependencies].reverse() });
      for (const [id, route] of result.routes)
        expect(reordered.routes.get(id)!.points).toEqual(route.points);
    });
  },
);

test('keeps near-aligned vertical ports straight and retains necessary larger bends', () => {
  withRouter((router) => {
    for (const offset of [3, 12]) {
      const result = router.route({
        obstacles: [body('a', 0, 0), body('b', offset, 600)],
        dependencies: [{ id: 'ab', source: 'a', target: 'b' }],
      });
      expect(result.blocked).toBe(0);
      const points = result.routes.get('ab')!.points;
      expect(new Set(points.map(({ x }) => x)).size).toBe(offset === 3 ? 1 : 2);
      expect(points.at(-1)).toEqual({ x: 60 + offset, y: 600 });
    }
  });
});

test('keeps dense shared ports inside the side with distinct bounded slots', () => {
  withRouter((router) => {
    const count = 20;
    const input = {
      obstacles: [
        body('hub', 0, 0),
        ...Array.from({ length: count }, (_, i) => body(String(i), 600, i * 10 - 60, 120, 8)),
      ],
      dependencies: Array.from({ length: count }, (_, i) => ({
        id: String(i),
        source: 'hub',
        target: String(i),
      })),
    };
    const result = router.route(input);
    expect(result.blocked).toBe(0);
    const endpoints = [...result.routes.values()].map(({ points }) => points[0]);
    for (const point of endpoints) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(120);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(80);
    }
    expect(new Set(endpoints.map(({ x, y }) => `${x},${y}`)).size).toBe(count);
  });
});

test('preview and saved dependencies have identical routes despite transient IDs and native history', () => {
  const base: RoutingScene = {
    obstacles: [
      body('a', 0, 0),
      body('b', 600, 0),
      body('c', 600, 160),
      body('middle', 280, -40, 140, 160),
    ],
    dependencies: [{ id: 'ab', source: 'a', target: 'b' }],
  };
  withRouter((live) => {
    live.route(base);
    live.route({
      ...base,
      obstacles: base.obstacles.map((rect) =>
        rect.nodeId === 'middle' ? { ...rect, y: 300 } : rect,
      ),
    });
    live.route({ ...base, dependencies: [{ id: 'ab', source: 'b', target: 'c' }] });
    withRouter((preview) => {
      const speculative = preview.route({
        ...base,
        dependencies: [
          ...base.dependencies,
          { id: '__connection-preview__', source: 'a', target: 'c' },
        ],
      });
      const saved = live.route({
        obstacles: [...base.obstacles].reverse(),
        dependencies: [
          { id: 'saved-persisted-id', source: 'a', target: 'c' },
          ...base.dependencies,
        ],
      });
      expect(speculative.blocked).toBe(0);
      expect(saved.blocked).toBe(0);
      expect(saved.routes.get('saved-persisted-id')).toEqual(
        speculative.routes.get('__connection-preview__'),
      );
      expect(saved.routes.get('ab')).toEqual(speculative.routes.get('ab'));
    });
  });
});

test('rebuilds canonical routes after movement and connector history', () => {
  const input: RoutingScene = {
    obstacles: [body('0', 0, 40), body('1', 300, 0), body('2', 600, 40), body('3', 0, 320)],
    dependencies: [0, 1, 2].map((i) => ({
      id: `edge-${i}`,
      source: String(i),
      target: String(i + 1),
    })),
  };
  withRouter((live) => {
    live.route({
      ...input,
      obstacles: input.obstacles.map((rect, i) => ({ ...rect, y: rect.y + [80, 40, 0, 120][i] })),
    });
    live.route({ ...input, dependencies: input.dependencies.slice(0, 2) });
    const saved = live.route({
      obstacles: [...input.obstacles].reverse(),
      dependencies: [...input.dependencies].reverse(),
    });
    withRouter((fresh) => {
      const expected = fresh.route(input);
      expect([...saved.routes].sort()).toEqual([...expected.routes].sort());
    });
  });
});
