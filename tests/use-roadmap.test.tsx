import { renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useRoadmap } from '../src/features/roadmap/useRoadmap';

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

test('deleting a dependency persists the change and reloads the roadmap', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json(roadmap('before-delete')))
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json(roadmap('after-delete')));
  vi.stubGlobal('fetch', fetchMock);

  const { result } = renderHook(() => useRoadmap(firstOffering));
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('before-delete'));

  await expect(result.current.deleteDependency('dependency-1')).resolves.toBe(true);

  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/MAT101/2026/1/roadmap/dependencies/dependency-1',
    expect.objectContaining({ method: 'DELETE' }),
  );
  await waitFor(() => expect(result.current.roadmap?.roadmap.id).toBe('after-delete'));
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
