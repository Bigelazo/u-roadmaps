import { afterEach, expect, test, vi } from 'vitest';
import type {
  CanvasCommand,
  ChangeImpactCommand,
} from '@/features/roadmap/canvas/commands/commands';
import { createHttpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';
import { RoadmapAccessLostError, RoadmapClosedError } from '@/features/roadmap/session/access-lost';

const http = createHttpRoadmapCanvasSessionPersistence({
  courseCode: 'CC1001',
  year: 2026,
  semester: 2,
});

const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [],
  nodes: [],
  dependencies: [],
};

const json = { 'Content-Type': 'application/json' };
const dependency = {
  sourceNodeId: 'node-1',
  targetNodeId: 'node-2',
  sourceHandle: 'bottom',
  targetHandle: 'top',
} as const;
const link = { title: 'Guía', url: 'https://example.test/guide', type: 'LINK' as const };
const nodeType = { name: 'Taller', icon: 'Shapes' as const, color: '#024AD8' as const };
const nodeUpdate = { title: 'Límites', description: '', nodeTypeId: 'content' };
const file = new File(['contenido'], 'apuntes.pdf', { type: 'application/pdf' });
const deletionImpact = {
  node: { title: 'Límites', nodeType: { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' } },
  dependencies: [],
  resources: [],
  version: 'deletion-version',
};
const hidingImpact = {
  dependencies: [{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }],
  version: 'hide-version',
};

const api = (suffix: string) => `/api/CC1001/2026/2/roadmap${suffix}`;

type Request = readonly [path: string, init: RequestInit];

type Execution = {
  command: CanvasCommand;
  previewVersion?: string;
  requests: readonly Request[];
  response?: unknown;
  resolves?: unknown;
};

const scheduledUnlockResponse = {
  title: 'Límites',
  teacherUnlockAt: '2026-11-01T12:00:00.000Z',
  teacherUnlockIncludesDependents: false,
  scheduledPrerequisiteIds: ['node-2'],
};

const executions: Record<string, Execution> = {
  'complete a Node': {
    command: { kind: 'complete-node', nodeId: 'node-1' },
    requests: [['/nodes/node-1/completion', { method: 'POST' }]],
  },
  'add a Node, move the Nodes it pushed aside and resolve with its identifier': {
    command: {
      kind: 'add-node',
      node: { title: 'Límites', description: '', nodeTypeId: 'content', isVisible: true },
      position: { x: 10, y: 20 },
      displaced: [{ nodeId: 'node-2', position: { x: 10, y: 140 } }],
    },
    requests: [
      [
        '/nodes',
        {
          method: 'POST',
          headers: json,
          body: JSON.stringify({
            title: 'Límites',
            description: null,
            nodeTypeId: 'content',
            isVisible: true,
            positionX: 10,
            positionY: 20,
          }),
        },
      ],
      [
        '/nodes/node-2',
        { method: 'PATCH', headers: json, body: JSON.stringify({ positionX: 10, positionY: 140 }) },
      ],
    ],
    response: { node: { id: 'node-9' } },
    resolves: { createdNodeId: 'node-9' },
  },
  'update a Node': {
    command: { kind: 'update-node', nodeId: 'node-1', value: nodeUpdate },
    requests: [
      [
        '/nodes/node-1',
        {
          method: 'PATCH',
          headers: json,
          body: JSON.stringify({ ...nodeUpdate, description: null }),
        },
      ],
    ],
  },
  'move Nodes, one change per Node': {
    command: {
      kind: 'move-nodes',
      positions: [
        { nodeId: 'node-1', position: { x: 30, y: 40 } },
        { nodeId: 'node-2', position: { x: 50, y: 60 } },
      ],
    },
    requests: [
      [
        '/nodes/node-1',
        { method: 'PATCH', headers: json, body: JSON.stringify({ positionX: 30, positionY: 40 }) },
      ],
      [
        '/nodes/node-2',
        { method: 'PATCH', headers: json, body: JSON.stringify({ positionX: 50, positionY: 60 }) },
      ],
    ],
  },
  'apply the chosen automatic layout as Node moves': {
    command: {
      kind: 'apply-automatic-layout',
      layouts: {
        TB: [{ nodeId: 'node-2', position: { x: 90, y: 90 } }],
        LR: [{ nodeId: 'node-1', position: { x: 0, y: 200 } }],
      },
      direction: 'LR',
    },
    requests: [
      [
        '/nodes/node-1',
        { method: 'PATCH', headers: json, body: JSON.stringify({ positionX: 0, positionY: 200 }) },
      ],
    ],
  },
  'create a Dependency with its preview version': {
    command: { kind: 'create-dependency', ...dependency },
    previewVersion: 'dependency-version',
    requests: [
      [
        '/dependencies',
        {
          method: 'POST',
          headers: { ...json, 'x-dependency-preview': 'dependency-version' },
          body: JSON.stringify(dependency),
        },
      ],
    ],
  },
  'delete a Dependency': {
    command: { kind: 'delete-dependencies', dependencyIds: ['dependency-1'] },
    requests: [['/dependencies/dependency-1', { method: 'DELETE' }]],
  },
  'place a Teacher block with its preview version': {
    command: { kind: 'change-teacher-block', nodeId: 'node-1', operation: 'BLOCK' },
    previewVersion: 'block-version',
    requests: [
      [
        '/nodes/node-1/teacher-block',
        { method: 'POST', headers: { 'x-teacher-block-preview': 'block-version' } },
      ],
    ],
  },
  'unlock a Node with its preview version': {
    command: { kind: 'change-teacher-block', nodeId: 'node-1', operation: 'UNBLOCK' },
    previewVersion: 'unlock-version',
    requests: [
      [
        '/nodes/node-1/teacher-block',
        { method: 'DELETE', headers: { 'x-teacher-block-preview': 'unlock-version' } },
      ],
    ],
  },
  'unlock a branch with its preview version': {
    command: { kind: 'change-teacher-block', nodeId: 'node-1', operation: 'BRANCH_UNLOCK' },
    previewVersion: 'branch-version',
    requests: [
      [
        '/nodes/node-1/teacher-block',
        { method: 'PATCH', headers: { 'x-teacher-block-preview': 'branch-version' } },
      ],
    ],
  },
  'schedule an unlock': {
    command: {
      kind: 'schedule-teacher-unlock',
      nodeId: 'node-1',
      unlockAt: '2026-11-01T12:00:00.000Z',
    },
    requests: [
      [
        '/nodes/node-1/teacher-block/schedule',
        {
          method: 'PUT',
          headers: json,
          body: JSON.stringify({ unlockAt: '2026-11-01T12:00:00.000Z' }),
        },
      ],
    ],
    response: scheduledUnlockResponse,
    resolves: { scheduledUnlock: { title: 'Límites', prerequisites: 1 } },
  },
  'schedule an unlock with its dependents': {
    command: {
      kind: 'schedule-teacher-unlock',
      nodeId: 'node-1',
      unlockAt: '2026-11-01T12:00:00.000Z',
      includeDependents: true,
    },
    requests: [
      [
        '/nodes/node-1/teacher-block/schedule',
        {
          method: 'PUT',
          headers: json,
          body: JSON.stringify({ unlockAt: '2026-11-01T12:00:00.000Z', includeDependents: true }),
        },
      ],
    ],
    response: scheduledUnlockResponse,
    resolves: { scheduledUnlock: { title: 'Límites', prerequisites: 1 } },
  },
  'cancel a Scheduled unlock': {
    command: { kind: 'schedule-teacher-unlock', nodeId: 'node-1', unlockAt: null },
    requests: [['/nodes/node-1/teacher-block/schedule', { method: 'DELETE' }]],
    response: { ...scheduledUnlockResponse, teacherUnlockAt: null, scheduledPrerequisiteIds: [] },
    resolves: { scheduledUnlock: { title: 'Límites', prerequisites: 0 } },
  },
  'hide a Node with its preview version': {
    command: { kind: 'hide-node', nodeId: 'node-1' },
    previewVersion: 'hide-version',
    requests: [
      [
        '/nodes/node-1',
        {
          method: 'PATCH',
          headers: { ...json, 'x-node-visibility-preview': 'hide-version' },
          body: JSON.stringify({ isVisible: false }),
        },
      ],
    ],
  },
  'show a Node': {
    command: { kind: 'show-node', nodeId: 'node-1' },
    requests: [
      [
        '/nodes/node-1',
        { method: 'PATCH', headers: json, body: JSON.stringify({ isVisible: true }) },
      ],
    ],
  },
  'delete a Node with its preview version': {
    command: { kind: 'delete-node', nodeId: 'node-1' },
    previewVersion: 'deletion-version',
    requests: [
      [
        '/nodes/node-1',
        { method: 'DELETE', headers: { 'x-node-delete-preview': 'deletion-version' } },
      ],
    ],
  },
  'add a link Resource': {
    command: { kind: 'add-resource', nodeId: 'node-1', resource: link },
    requests: [
      ['/nodes/node-1/resources', { method: 'POST', headers: json, body: JSON.stringify(link) }],
    ],
  },
  'update a link Resource': {
    command: { kind: 'update-resource', resourceId: 'resource-1', resource: link },
    requests: [
      ['/resources/resource-1', { method: 'PATCH', headers: json, body: JSON.stringify(link) }],
    ],
  },
  'rename a file Resource without resubmitting its protected download URL': {
    command: {
      kind: 'update-resource',
      resourceId: 'resource-1',
      resource: {
        title: 'Guía.docx',
        url: '/api/CC1001/2026/2/roadmap/resources/resource-1/file',
        type: 'FILE',
      },
    },
    requests: [
      [
        '/resources/resource-1',
        { method: 'PATCH', headers: json, body: JSON.stringify({ title: 'Guía.docx' }) },
      ],
    ],
  },
  'delete a Resource': {
    command: { kind: 'delete-resource', resourceId: 'resource-1' },
    requests: [['/resources/resource-1', { method: 'DELETE' }]],
  },
  'add a Node type': {
    command: { kind: 'add-node-type', nodeType },
    requests: [['/node-types', { method: 'POST', headers: json, body: JSON.stringify(nodeType) }]],
  },
  'update a Node type': {
    command: { kind: 'update-node-type', nodeTypeId: 'type-1', nodeType },
    requests: [
      ['/node-types/type-1', { method: 'PATCH', headers: json, body: JSON.stringify(nodeType) }],
    ],
  },
  'delete a Node type': {
    command: { kind: 'delete-node-type', nodeTypeId: 'type-1' },
    requests: [['/node-types/type-1', { method: 'DELETE' }]],
  },
  'complete a Node in the Canvas preview': {
    command: { kind: 'complete-canvas-preview-node', nodeId: 'node-1' },
    requests: [['/simulation/nodes/node-1/completion', { method: 'POST' }]],
  },
  'reset the Canvas preview': {
    command: { kind: 'reset-canvas-preview' },
    requests: [['/simulation', { method: 'DELETE' }]],
  },
};

const changeImpacts: Record<
  string,
  { command: ChangeImpactCommand; path: string; response: unknown }
> = {
  'read the Change impact of a Dependency': {
    command: { kind: 'create-dependency', ...dependency },
    path: '/dependencies?sourceNodeId=node-1&targetNodeId=node-2&sourceHandle=bottom&targetHandle=top',
    response: { nodes: [{ id: 'node-3', title: 'Derivadas' }], version: 'dependency-version' },
  },
  'read the Change impact of a Teacher block': {
    command: { kind: 'change-teacher-block', nodeId: 'node-1', operation: 'BLOCK' },
    path: '/nodes/node-1/teacher-block?operation=BLOCK',
    response: { mode: 'BLOCK', nodes: [], version: 'block-version' },
  },
  'read the Change impact of a Branch unlock': {
    command: { kind: 'change-teacher-block', nodeId: 'node-1', operation: 'BRANCH_UNLOCK' },
    path: '/nodes/node-1/teacher-block?operation=BRANCH_UNLOCK',
    response: { mode: 'BRANCH', nodes: [], version: 'branch-version' },
  },
  'read the Change impact of hiding a Node': {
    command: { kind: 'hide-node', nodeId: 'node-1' },
    path: '/nodes/node-1?operation=HIDE',
    response: hidingImpact,
  },
  'read the Change impact of deleting a Node': {
    command: { kind: 'delete-node', nodeId: 'node-1' },
    path: '/nodes/node-1?operation=DELETE',
    response: deletionImpact,
  },
};

function respondWith(response?: unknown) {
  const fetchMock = vi.fn(async () =>
    response === undefined ? new Response(null, { status: 204 }) : Response.json(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function refuseWith(status: number, error?: { message: string; code?: string }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      error ? Response.json({ error }, { status }) : new Response(null, { status }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

test.each([
  ['load the Roadmap', () => http.load(), ''],
  ['load the Canvas preview', () => http.loadCanvasPreview(), '/simulation'],
] as const)('%s', async (_name, call, path) => {
  const fetchMock = respondWith(roadmap);

  await expect(call()).resolves.toEqual(roadmap);

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api(path), { cache: 'no-store' });
});

test.each(Object.entries(executions))(
  '%s',
  async (_name, { command, previewVersion, requests, response, resolves }) => {
    const fetchMock = respondWith(response);

    await expect(http.execute(command, previewVersion)).resolves.toEqual(resolves);

    expect(fetchMock.mock.calls).toEqual(requests.map(([path, init]) => [api(path), init]));
  },
);

test.each(Object.entries(changeImpacts))('%s', async (_name, { command, path, response }) => {
  const fetchMock = respondWith(response);

  await expect(http.readChangeImpact(command)).resolves.toEqual(response);

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api(path), {});
});

test('omits the preview header when a change sends no Change impact version', async () => {
  const fetchMock = respondWith();

  await http.execute({ kind: 'hide-node', nodeId: 'node-1' });

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api('/nodes/node-1'), {
    method: 'PATCH',
    headers: json,
    body: JSON.stringify({ isVisible: false }),
  });
});

test('uploads a file Resource as multipart form data without setting its boundary header', async () => {
  const fetchMock = respondWith();

  await http.execute({ kind: 'upload-resource', nodeId: 'node-1', file });

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api('/nodes/node-1/resources'), {
    method: 'POST',
    body: expect.any(FormData),
  });
  expect((fetchMock.mock.calls[0] as unknown as Request)[1].body).toSatisfy(
    (body: FormData) => body.get('file') === file,
  );
});

test('replaces a file Resource as multipart form data carrying its edited title', async () => {
  const fetchMock = respondWith();

  await http.execute({
    kind: 'update-resource',
    resourceId: 'resource-1',
    resource: { title: 'Guía.pdf', url: '/api/protected', type: 'FILE' },
    file,
  });

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api('/resources/resource-1'), {
    method: 'PATCH',
    body: expect.any(FormData),
  });
  expect((fetchMock.mock.calls[0] as unknown as Request)[1].body).toSatisfy(
    (body: FormData) =>
      body.get('file') === file && body.get('title') === 'Guía.pdf' && !body.has('url'),
  );
});

test('passes the server refusal message through', async () => {
  refuseWith(404, { message: 'El recurso no pertenece al roadmap.' });

  await expect(http.execute({ kind: 'delete-resource', resourceId: 'resource-1' })).rejects.toThrow(
    new Error('El recurso no pertenece al roadmap.'),
  );
});

test.each([
  [
    'a change',
    () => http.execute({ kind: 'delete-resource', resourceId: 'r' }),
    'No se pudo eliminar el recurso.',
  ],
  [
    'a Completion',
    () => http.execute({ kind: 'complete-node', nodeId: 'n' }),
    'No se pudo completar el nodo.',
  ],
  [
    'a Change impact read',
    () => http.readChangeImpact({ kind: 'hide-node', nodeId: 'n' }),
    'No se pudo calcular el impacto de ocultar el nodo.',
  ],
  [
    'the Canvas preview load',
    () => http.loadCanvasPreview(),
    'No se pudo cargar la previsualización.',
  ],
  ['the Roadmap load', () => http.load(), 'No se pudo cargar el roadmap.'],
] as const)(
  'uses the failure message of %s when the server sends no error message',
  async (_name, call, message) => {
    refuseWith(500);

    await expect(call()).rejects.toThrow(new Error(message));
  },
);

test.each([401, 403, 404])(
  'a load denied with %i means the Roadmap access was lost',
  async (status) => {
    refuseWith(status, { message: 'No tienes acceso a este roadmap.' });

    await expect(http.load()).rejects.toThrow(
      new RoadmapAccessLostError('No tienes acceso a este roadmap.'),
    );
    await expect(http.load()).rejects.toBeInstanceOf(RoadmapAccessLostError);
  },
);

test('a denied change is not an access loss', async () => {
  refuseWith(403, { message: 'No puedes editar este roadmap.' });

  const failure = http.execute({ kind: 'complete-node', nodeId: 'node-1' });

  await expect(failure).rejects.toThrow('No puedes editar este roadmap.');
  await expect(failure).rejects.not.toBeInstanceOf(RoadmapAccessLostError);
});

test.each([
  ['a change', () => http.execute({ kind: 'complete-node', nodeId: 'node-1' })],
  ['a Change impact read', () => http.readChangeImpact({ kind: 'delete-node', nodeId: 'node-1' })],
  ['a load', () => http.load()],
] as const)('refuses %s on a closed Roadmap with the closed error', async (_name, call) => {
  refuseWith(409, { message: 'El roadmap está cerrado.', code: 'ROADMAP_CLOSED' });

  await expect(call()).rejects.toBeInstanceOf(RoadmapClosedError);
  await expect(call()).rejects.toThrow('El roadmap está cerrado.');
});

test('a batch with one failing item still sends the others and rethrows the failure', async () => {
  const fetchMock = vi.fn(async (url: string) =>
    url.endsWith('/node-1')
      ? Response.json({ error: { message: 'El nodo no existe.' } }, { status: 404 })
      : new Response(null, { status: 204 }),
  );
  vi.stubGlobal('fetch', fetchMock);

  await expect(
    http.execute({
      kind: 'move-nodes',
      positions: [
        { nodeId: 'node-1', position: { x: 0, y: 0 } },
        { nodeId: 'node-2', position: { x: 10, y: 10 } },
      ],
    }),
  ).rejects.toThrow('El nodo no existe.');

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    api('/nodes/node-1'),
    api('/nodes/node-2'),
  ]);
});

test('a Resource access is sent without waiting and only a Link needs the client to report it', () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetch);

  expect(http.recordResourceAccess({ id: 'link-1', type: 'LINK' }, 'roadmap')).toEqual({
    countsAccess: true,
  });
  expect(http.recordResourceAccess({ id: 'file-1', type: 'FILE' }, 'roadmap')).toEqual({
    countsAccess: true,
  });
  expect(http.recordResourceAccess({ id: 'file-1', type: 'FILE' }, 'canvas-preview')).toEqual({
    countsAccess: false,
  });

  expect(fetch.mock.calls).toEqual([
    [api('/resources/link-1/access'), { method: 'POST', keepalive: true }],
    [api('/simulation/resources/file-1/review'), { method: 'POST', keepalive: true }],
  ]);
});
