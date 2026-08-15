import { renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useRoadmap } from '../src/components/roadmap/useRoadmap';

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
    vi.fn((_url: string, init: RequestInit) =>
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
