import { afterEach, expect, test, vi } from 'vitest';
import { httpRoadmapCanvasSessionPersistence } from '@/features/roadmap/session/http-persistence';

const input = {
  courseOffering: {
    identifier: { courseCode: 'CC1001', year: 2026, semester: 2 },
    title: 'Programación I',
  },
  experience: { kind: 'teaching' as const, term: 'current' as const },
};

const roadmap = {
  course: { code: 'CC1001', name: 'Programación I', department: 'DCC' },
  courseOffering: { id: 'offering-1', year: 2026, semester: 2 },
  roadmap: { id: 'roadmap-1' },
  nodeTypes: [],
  nodes: [],
  dependencies: [],
};

afterEach(() => vi.unstubAllGlobals());

test('loads a teaching projection through the existing roadmap route', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(roadmap));
  vi.stubGlobal('fetch', fetchMock);

  await expect(httpRoadmapCanvasSessionPersistence.load(input)).resolves.toEqual(roadmap);
  expect(fetchMock).toHaveBeenCalledWith('/api/CC1001/2026/2/roadmap', {});
});

test('serializes link Resource updates as JSON while preserving the server contract', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);

  await httpRoadmapCanvasSessionPersistence.updateResource!(input, 'resource-1', {
    title: 'Guía actualizada',
    url: 'https://example.test/updated',
    type: 'LINK',
  });

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/CC1001/2026/2/roadmap/resources/resource-1',
    expect.objectContaining({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Guía actualizada',
        url: 'https://example.test/updated',
        type: 'LINK',
      }),
    }),
  );
});

test('uploads a file Resource as multipart form data without setting its boundary header', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  const file = new File(['contenido'], 'apuntes.pdf', { type: 'application/pdf' });

  await httpRoadmapCanvasSessionPersistence.uploadResource!(input, 'node-1', file);

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/CC1001/2026/2/roadmap/nodes/node-1/resources',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );
  expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('headers');
});

test('translates a server Resource failure into the existing user-facing message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({ error: { message: 'El recurso no pertenece al roadmap.' } }, { status: 404 }),
    ),
  );

  await expect(
    httpRoadmapCanvasSessionPersistence.deleteResource!(input, 'resource-1'),
  ).rejects.toThrow('El recurso no pertenece al roadmap.');
});
