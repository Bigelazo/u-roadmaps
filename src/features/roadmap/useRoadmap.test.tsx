import { renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useRoadmap } from './useRoadmap';

const firstOffering = { courseCode: 'MAT101', year: 2026, semester: 1 };
const secondOffering = { courseCode: 'MAT102', year: 2026, semester: 1 };

function roadmap(title: string) {
  return {
    course: { code: 'MAT102', name: 'Matematicas', department: 'DCC' },
    courseOffering: { id: 'offering-1', year: 2026, semester: 1 },
    roadmap: { id: title },
    nodeTypes: [],
    nodes: [],
    dependencies: [],
  };
}

test('rapid course-offering navigation aborts the stale roadmap load', async () => {
  const requests: Array<{ signal: AbortSignal; resolve: (response: Response) => void }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          requests.push({ signal: init.signal as AbortSignal, resolve });
        }),
    ),
  );

  const { result, rerender } = renderHook(({ identifier }) => useRoadmap(identifier), {
    initialProps: { identifier: firstOffering },
  });

  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ identifier: secondOffering });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(result.current.roadmap).toBeNull();
  expect(requests[0].signal.aborted).toBe(true);

  requests[0].resolve(Response.json(roadmap('stale')));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.roadmap).toBeNull();
  requests[1].resolve(Response.json(roadmap('current')));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('current'));
});

test('ignores a preview that resolves after navigating to another course offering', async () => {
  let resolvePreview: (response: Response) => void;
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('first')))
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolvePreview = resolve;
        }),
    )
    .mockResolvedValueOnce(Response.json(roadmap('second')));
  vi.stubGlobal('fetch', fetchMock);

  const { result, rerender } = renderHook(({ identifier }) => useRoadmap(identifier), {
    initialProps: { identifier: firstOffering },
  });
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('first'));

  const preview = result.current.previewNodeVisibility('node-1');
  rerender({ identifier: secondOffering });
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('second'));
  resolvePreview!(Response.json({ dependencies: [] }));

  await expect(preview).resolves.toBeNull();
});

const dependency = {
  id: 'dependency-1',
  sourceNodeId: 'node-1',
  targetNodeId: 'node-2',
  sourceHandle: 'right',
  targetHandle: 'left',
};

test('deleting a dependency drops it from the roadmap without reloading', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...roadmap('cargado'), dependencies: [dependency] }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.dependencies).toHaveLength(1));

  await expect(result.current.deleteDependency('dependency-1')).resolves.toBe(true);

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/MAT101/2026/1/roadmap/dependencies/dependency-1',
    expect.objectContaining({ method: 'DELETE' }),
  );
  await waitFor(() => expect(result.current.roadmap?.dependencies).toHaveLength(0));
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('creating a dependency reloads the effective blocked state returned by the server', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('cargado')))
    .mockResolvedValueOnce(Response.json({ dependency }, { status: 201 }))
    .mockResolvedValueOnce(
      Response.json({
        ...roadmap('bloqueado'),
        dependencies: [dependency],
        nodes: [
          {
            id: 'node-2',
            title: 'Nodo bloqueado',
            nodeTypeId: 'type-1',
            positionX: 0,
            positionY: 0,
            isTeacherBlocked: true,
          },
        ],
      }),
    );
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('cargado'));

  await expect(result.current.connectNodes('node-1', 'node-2', 'right', 'left')).resolves.toBe(
    true,
  );

  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('bloqueado'));
  expect(result.current.roadmap?.nodes[0]).toMatchObject({ isTeacherBlocked: true });
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('previews the structural impact before hiding a node or connecting a blocked branch', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('cargado')))
    .mockResolvedValueOnce(
      Response.json({
        dependencies: [{ id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' }],
      }),
    )
    .mockResolvedValueOnce(Response.json({ nodes: [{ id: 'node-3', title: 'Nodo afectado' }] }));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('cargado'));

  await expect(result.current.previewNodeVisibility('node-1')).resolves.toEqual([
    { id: 'dependency-1', sourceNodeId: 'node-1', targetNodeId: 'node-2' },
  ]);
  await expect(
    result.current.previewRoadmapDependency('node-1', 'node-3', 'right', 'left'),
  ).resolves.toEqual([{ id: 'node-3', title: 'Nodo afectado' }]);

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/MAT101/2026/1/roadmap/nodes/node-1?operation=HIDE',
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    '/api/MAT101/2026/1/roadmap/dependencies?sourceNodeId=node-1&targetNodeId=node-3&sourceHandle=right&targetHandle=left',
  );
});

test('previews and applies teacher-block actions with a server refresh', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('before')))
    .mockResolvedValueOnce(Response.json({ nodes: [{ id: 'node-1', title: 'Límites' }] }))
    .mockResolvedValueOnce(Response.json({ nodes: [{ id: 'node-1', title: 'Límites' }] }))
    .mockResolvedValueOnce(Response.json(roadmap('after')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('before'));

  await expect(result.current.previewTeacherBlock('node-1', 'BLOCK')).resolves.toEqual([
    { id: 'node-1', title: 'Límites' },
  ]);
  await expect(result.current.changeTeacherBlock('node-1', 'BLOCK')).resolves.toBe(true);

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/MAT101/2026/1/roadmap/nodes/node-1/teacher-block?operation=BLOCK',
  );
  expect(fetchMock).toHaveBeenNthCalledWith(
    3,
    '/api/MAT101/2026/1/roadmap/nodes/node-1/teacher-block',
    expect.objectContaining({ method: 'POST' }),
  );
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after'));
});

test('reloads the canvas and explains a concurrent hidden-node dependency error', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('before')))
    .mockResolvedValueOnce(
      Response.json(
        { error: { message: 'No se pueden crear dependencias con nodos ocultos.' } },
        { status: 403 },
      ),
    )
    .mockResolvedValueOnce(Response.json(roadmap('after-concurrent-hide')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('before'));

  await expect(result.current.connectNodes('node-1', 'node-2')).resolves.toBe(false);

  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after-concurrent-hide'));
  expect(result.current.error).toBe('No se pueden crear dependencias con nodos ocultos.');
});

test('a failed dependency creation reloads the roadmap and exposes the error', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('cargado')))
    .mockResolvedValueOnce(
      Response.json({ error: { message: 'La dependencia crea un ciclo.' } }, { status: 409 }),
    )
    .mockResolvedValueOnce(Response.json(roadmap('recargado')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('cargado'));

  await expect(result.current.connectNodes('node-1', 'node-2')).resolves.toBe(false);

  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('recargado'));
  expect(result.current.error).toBe('La dependencia crea un ciclo.');
});

test('a failed dependency deletion keeps the roadmap and exposes the error', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(Response.json(roadmap('before-delete')))
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: 'No se puede eliminar la dependencia.' } },
          { status: 409 },
        ),
      ),
  );

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('before-delete'));

  await expect(result.current.deleteDependency('dependency-1')).resolves.toBe(false);

  expect(result.current.roadmap?.roadmap.id).toBe('before-delete');
  await waitFor(() => expect(result.current.error).toBe('No se puede eliminar la dependencia.'));
});

test('resource and custom node-type mutations persist and reload the roadmap', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('initial')))
    .mockResolvedValueOnce(Response.json({ resource: {} }))
    .mockResolvedValueOnce(Response.json(roadmap('after-resource-update')))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json(roadmap('after-resource-delete')))
    .mockResolvedValueOnce(Response.json({ nodeType: {} }))
    .mockResolvedValueOnce(Response.json(roadmap('after-type-update')))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json(roadmap('after-type-delete')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('initial'));

  await expect(
    result.current.updateResource('resource-1', {
      title: 'Guia actualizada',
      url: 'https://example.test/guide',
      type: 'VIDEO',
    }),
  ).resolves.toBe(true);
  await expect(result.current.deleteResource('resource-1')).resolves.toBe(true);
  await expect(
    result.current.updateNodeType('type-1', { name: 'Laboratorio', color: '#123456' }),
  ).resolves.toBe(true);
  await expect(result.current.deleteNodeType('type-1')).resolves.toBe(true);

  expect(fetchMock).toHaveBeenCalledWith(
    '/api/MAT101/2026/1/roadmap/resources/resource-1',
    expect.objectContaining({ method: 'PATCH' }),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/MAT101/2026/1/roadmap/node-types/type-1',
    expect.objectContaining({ method: 'PATCH' }),
  );
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after-type-delete'));
});

test('uploads a file resource as multipart form data and reloads the roadmap', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('initial')))
    .mockResolvedValueOnce(Response.json({ resource: {} }, { status: 201 }))
    .mockResolvedValueOnce(Response.json(roadmap('after-upload')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('initial'));

  const file = new File(['guía'], 'guia.pdf', { type: 'application/pdf' });
  await expect(result.current.uploadResource('node-1', file)).resolves.toBe(true);

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/MAT101/2026/1/roadmap/nodes/node-1/resources',
    expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
  );
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after-upload'));
});

test('reloads the effective blocked state after a concurrent completion rejection', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('before-block')))
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: 'TEACHER_BLOCK', message: 'Bloqueado por el equipo docente' } },
        { status: 403 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({
        ...roadmap('after-block'),
        nodes: [
          {
            id: 'node-1',
            title: 'Nodo bloqueado',
            nodeTypeId: 'type-1',
            positionX: 0,
            positionY: 0,
            access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
          },
        ],
      }),
    );
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('before-block'));

  await expect(result.current.completeNode('node-1')).resolves.toBe(false);

  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after-block'));
  expect(result.current.roadmap?.nodes[0]).toMatchObject({
    access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
  });
  expect(result.current.error).toBe('Bloqueado por el equipo docente');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
