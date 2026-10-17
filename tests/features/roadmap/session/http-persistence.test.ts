import { afterEach, expect, test, vi } from 'vitest';
import { httpRoadmapCanvasSessionPersistence as http } from '@/features/roadmap/session/http-persistence';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';

const input = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Programación I',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
} satisfies RoadmapCanvasSessionInput;

const studentInput = {
  ...input,
  experience: { kind: 'student' as const, term: 'current' as const },
} satisfies RoadmapCanvasSessionInput;

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

type Mapping = {
  call: () => Promise<unknown>;
  path: string;
  init: RequestInit;
  response?: unknown;
  resolves?: unknown;
};

const api = (suffix: string) => `/api/CC1001/2026/2/roadmap${suffix}`;

/** Every persistence operation and the request it sends; previewed changes forward their version. */
const mappings: Record<string, Mapping> = {
  'load a teaching Roadmap': {
    call: () => http.load(input),
    path: '',
    init: { cache: 'no-store' },
    response: roadmap,
    resolves: roadmap,
  },
  'load a student Roadmap': {
    call: () => http.load(studentInput),
    path: '',
    init: { cache: 'no-store' },
    response: roadmap,
    resolves: roadmap,
  },
  'load the Canvas preview': {
    call: () => http.loadSimulation(input),
    path: '/simulation',
    init: { cache: 'no-store' },
    response: roadmap,
    resolves: roadmap,
  },
  'complete a Node': {
    call: () => http.complete(studentInput, 'node-1'),
    path: '/nodes/node-1/completion',
    init: { method: 'POST' },
  },
  'add a Node': {
    call: () =>
      http.addNode(
        input,
        { title: 'Límites', description: '', nodeTypeId: 'content', isVisible: true },
        { x: 10, y: 20 },
      ),
    path: '/nodes',
    init: {
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
    response: { node: { id: 'node-9' } },
    resolves: 'node-9',
  },
  'update a Node': {
    call: () => http.updateNode(input, 'node-1', nodeUpdate),
    path: '/nodes/node-1',
    init: {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ ...nodeUpdate, description: null }),
    },
  },
  'move a Node': {
    call: () => http.moveNode(input, 'node-1', { x: 30, y: 40 }),
    path: '/nodes/node-1',
    init: {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ positionX: 30, positionY: 40 }),
    },
  },
  'preview a Dependency': {
    call: () => http.previewRoadmapDependency(input, dependency),
    path: '/dependencies?sourceNodeId=node-1&targetNodeId=node-2&sourceHandle=bottom&targetHandle=top',
    init: {},
    response: { nodes: [{ id: 'node-3', title: 'Derivadas' }], version: 'dependency-version' },
    resolves: { nodes: [{ id: 'node-3', title: 'Derivadas' }], version: 'dependency-version' },
  },
  'create a Dependency with its preview version': {
    call: () => http.connectNodes(input, dependency, 'dependency-version'),
    path: '/dependencies',
    init: {
      method: 'POST',
      headers: { ...json, 'x-dependency-preview': 'dependency-version' },
      body: JSON.stringify(dependency),
    },
  },
  'delete a Dependency': {
    call: () => http.deleteDependency(input, 'dependency-1'),
    path: '/dependencies/dependency-1',
    init: { method: 'DELETE' },
  },
  'preview a Teacher block': {
    call: () => http.previewTeacherBlock(input, 'node-1', 'BLOCK'),
    path: '/nodes/node-1/teacher-block?operation=BLOCK',
    init: {},
    response: { mode: 'BLOCK', nodes: [], version: 'block-version' },
    resolves: { mode: 'BLOCK', nodes: [], version: 'block-version' },
  },
  'place a Teacher block with its preview version': {
    call: () => http.changeTeacherBlock(input, 'node-1', 'BLOCK', 'block-version'),
    path: '/nodes/node-1/teacher-block',
    init: { method: 'POST', headers: { 'x-teacher-block-preview': 'block-version' } },
  },
  'unlock a Node with its preview version': {
    call: () => http.changeTeacherBlock(input, 'node-1', 'UNBLOCK', 'unlock-version'),
    path: '/nodes/node-1/teacher-block',
    init: { method: 'DELETE', headers: { 'x-teacher-block-preview': 'unlock-version' } },
  },
  'unlock a branch with its preview version': {
    call: () => http.changeTeacherBlock(input, 'node-1', 'BRANCH_UNLOCK', 'branch-version'),
    path: '/nodes/node-1/teacher-block',
    init: { method: 'PATCH', headers: { 'x-teacher-block-preview': 'branch-version' } },
  },
  'schedule an unlock': {
    call: () => http.scheduleTeacherUnlock(input, 'node-1', '2026-11-01'),
    path: '/nodes/node-1/teacher-block/schedule',
    init: { method: 'PUT', headers: json, body: JSON.stringify({ unlockOn: '2026-11-01' }) },
  },
  'cancel a Scheduled unlock': {
    call: () => http.scheduleTeacherUnlock(input, 'node-1', null),
    path: '/nodes/node-1/teacher-block/schedule',
    init: { method: 'DELETE' },
  },
  'preview hiding a Node': {
    call: () => http.previewNodeHiding(input, 'node-1'),
    path: '/nodes/node-1?operation=HIDE',
    init: {},
    response: {
      dependencies: [{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }],
      version: 'hide-version',
    },
    resolves: {
      dependencies: [{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }],
      version: 'hide-version',
    },
  },
  'hide a Node with its preview version': {
    call: () => http.setVisibility(input, 'node-1', false, 'hide-version'),
    path: '/nodes/node-1',
    init: {
      method: 'PATCH',
      headers: { ...json, 'x-node-visibility-preview': 'hide-version' },
      body: JSON.stringify({ isVisible: false }),
    },
  },
  'show a Node': {
    call: () => http.setVisibility(input, 'node-1', true),
    path: '/nodes/node-1',
    init: { method: 'PATCH', headers: json, body: JSON.stringify({ isVisible: true }) },
  },
  'preview deleting a Node': {
    call: () => http.previewNodeDeletion(input, 'node-1'),
    path: '/nodes/node-1?operation=DELETE',
    init: {},
    response: deletionImpact,
    resolves: deletionImpact,
  },
  'delete a Node with its preview version': {
    call: () => http.deleteNode(input, 'node-1', 'deletion-version'),
    path: '/nodes/node-1',
    init: { method: 'DELETE', headers: { 'x-node-delete-preview': 'deletion-version' } },
  },
  'add a link Resource': {
    call: () => http.addResource(input, 'node-1', link),
    path: '/nodes/node-1/resources',
    init: { method: 'POST', headers: json, body: JSON.stringify(link) },
  },
  'update a link Resource': {
    call: () => http.updateResource(input, 'resource-1', link),
    path: '/resources/resource-1',
    init: { method: 'PATCH', headers: json, body: JSON.stringify(link) },
  },
  'rename a file Resource without resubmitting its protected download URL': {
    call: () =>
      http.updateResource(input, 'resource-1', {
        title: 'Guía.docx',
        url: '/api/CC1001/2026/2/roadmap/resources/resource-1/file',
        type: 'FILE',
      }),
    path: '/resources/resource-1',
    init: { method: 'PATCH', headers: json, body: JSON.stringify({ title: 'Guía.docx' }) },
  },
  'delete a Resource': {
    call: () => http.deleteResource(input, 'resource-1'),
    path: '/resources/resource-1',
    init: { method: 'DELETE' },
  },
  'add a Node type': {
    call: () => http.addNodeType(input, nodeType),
    path: '/node-types',
    init: { method: 'POST', headers: json, body: JSON.stringify(nodeType) },
  },
  'update a Node type': {
    call: () => http.updateNodeType(input, 'type-1', nodeType),
    path: '/node-types/type-1',
    init: { method: 'PATCH', headers: json, body: JSON.stringify(nodeType) },
  },
  'delete a Node type': {
    call: () => http.deleteNodeType(input, 'type-1'),
    path: '/node-types/type-1',
    init: { method: 'DELETE' },
  },
  'complete a Node in the Canvas preview': {
    call: () => http.completeSimulatedNode(input, 'node-1'),
    path: '/simulation/nodes/node-1/completion',
    init: { method: 'POST' },
  },
  'reset the Canvas preview': {
    call: () => http.resetSimulation(input),
    path: '/simulation',
    init: { method: 'DELETE' },
  },
};

afterEach(() => vi.unstubAllGlobals());

test.each(Object.entries(mappings))(
  '%s',
  async (_name, { call, path, init, response, resolves }) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response === undefined ? new Response(null, { status: 204 }) : Response.json(response),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(call()).resolves.toEqual(resolves);

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(api(path), init);
  },
);

test('omits the preview header when a previewed change sends no version', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);

  await http.setVisibility(input, 'node-1', false);
  await http.connectNodes(input, dependency);
  await http.deleteNode(input, 'node-1');

  for (const [, init] of fetchMock.mock.calls) {
    expect(Object.keys((init as RequestInit).headers ?? {})).not.toContainEqual(
      expect.stringMatching(/^x-/),
    );
  }
});

test('uploads a file Resource as multipart form data without setting its boundary header', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);

  await http.uploadResource(input, 'node-1', file);

  expect(fetchMock).toHaveBeenCalledWith(
    api('/nodes/node-1/resources'),
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );
  expect((fetchMock.mock.calls[0]?.[1] as RequestInit).body).toSatisfy(
    (body: FormData) => body.get('file') === file,
  );
  expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('headers');
});

test('rejects a preview without a version, which the confirmation could not send back', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ dependencies: [] })));

  await expect(http.previewNodeHiding(input, 'node-1')).rejects.toThrow(
    'No se pudo calcular el impacto de ocultar el nodo.',
  );
});

test('translates a server Resource failure into the existing user-facing message', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { message: 'El recurso no pertenece al roadmap.' } },
          { status: 404 },
        ),
      ),
  );

  await expect(http.deleteResource(input, 'resource-1')).rejects.toThrow(
    'El recurso no pertenece al roadmap.',
  );
});
