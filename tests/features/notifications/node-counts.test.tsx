import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NodeChangeCountsProvider,
  useNodeChangeCount,
} from '@/features/notifications/components/inbox-driver';

afterEach(() => vi.unstubAllGlobals());
function Nodes() {
  const first = useNodeChangeCount('first');
  const second = useNodeChangeCount('second');
  return (
    <p>
      {first ?? 'unknown'} and {second ?? 'unknown'}
    </p>
  );
}
test('Nodes share one grouped request loaded once on mount', async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ byNode: { first: 2, second: 3 } }));
  vi.stubGlobal('fetch', fetch);
  render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  await screen.findByText('2 and 3');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/notifications/node-changes?roadmapId=roadmap');
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('disabled canvas counts do not load or expose real notices', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled={false}>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  expect(screen.getByText('unknown and unknown')).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

test('a late response cannot overwrite another Roadmap', async () => {
  let resolveOld!: (response: Response) => void;
  const old = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const fetch = vi
    .fn()
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce(Response.json({ byNode: { second: 1 } }));
  vi.stubGlobal('fetch', fetch);
  const { rerender } = render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  rerender(
    <NodeChangeCountsProvider roadmapId="other" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  expect(screen.getByText('unknown and unknown')).toBeTruthy();
  await screen.findByText('0 and 1');
  await act(async () => resolveOld(Response.json({ byNode: { first: 9 } })));
  expect(screen.getByText('0 and 1')).toBeTruthy();
});

test('opening a changed Node reviews it once and reloads the counts', async () => {
  let counts: Record<string, number> = { first: 2, second: 1 };
  const reviews: unknown[] = [];
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { nodeId: string };
      reviews.push(body);
      counts = { ...counts, [body.nodeId]: 0 };
      return Response.json({ reviewed: true });
    }
    expect(url).toBe('/api/notifications/node-changes?roadmapId=roadmap');
    return Response.json({ byNode: counts });
  });
  vi.stubGlobal('fetch', fetch);
  const view = (openedNodeId: string | null) => (
    <NodeChangeCountsProvider roadmapId="roadmap" openedNodeId={openedNodeId} enabled>
      <Nodes />
    </NodeChangeCountsProvider>
  );
  const { rerender } = render(view(null));
  await screen.findByText('2 and 1');
  expect(reviews).toEqual([]);

  rerender(view('first'));
  await screen.findByText('0 and 1');
  expect(reviews).toEqual([{ roadmapId: 'roadmap', nodeId: 'first' }]);

  expect(fetch.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(2);

  rerender(view(null));
  rerender(view('first'));
  expect(reviews).toHaveLength(1);
});

test('opening an unchanged Node does not record a review', async () => {
  const methods: (string | undefined)[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      methods.push(init?.method);
      return Response.json({ byNode: { second: 1 } });
    }),
  );
  render(
    <NodeChangeCountsProvider roadmapId="roadmap" openedNodeId="first" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  await screen.findByText('0 and 1');
  expect(methods).not.toContain('POST');
});
