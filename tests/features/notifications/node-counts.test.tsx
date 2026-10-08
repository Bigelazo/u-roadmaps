import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NodeChangeCountsProvider,
  useNodeChangeCount,
} from '@/features/notifications/components/inbox-driver';
import { OWN_INBOX_REFRESH_EVENT } from '@/features/notifications/components/own-realtime';

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
test('Nodes share one grouped request and preserve known counts through failure and retry', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ byNode: { first: 2, second: 3 } }))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ byNode: { second: 1 } }));
  vi.stubGlobal('fetch', fetch);
  render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  await screen.findByText('2 and 3');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/notifications/node-changes?roadmapId=roadmap');
  act(() => window.dispatchEvent(new Event(OWN_INBOX_REFRESH_EVENT)));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.getByText('2 and 3')).toBeTruthy();
  await screen.findByText('0 and 1', {}, { timeout: 2500 });
  expect(fetch).toHaveBeenCalledTimes(3);
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

test('late responses cannot overwrite a newer refresh or another Roadmap', async () => {
  let resolveOld!: (response: Response) => void;
  const old = new Promise<Response>((resolve) => {
    resolveOld = resolve;
  });
  const fetch = vi
    .fn()
    .mockReturnValueOnce(old)
    .mockResolvedValueOnce(Response.json({ byNode: { first: 3 } }))
    .mockResolvedValueOnce(Response.json({ byNode: { second: 1 } }));
  vi.stubGlobal('fetch', fetch);
  const { rerender } = render(
    <NodeChangeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  act(() => window.dispatchEvent(new Event(OWN_INBOX_REFRESH_EVENT)));
  await screen.findByText('3 and 0');
  await act(async () => resolveOld(Response.json({ byNode: { first: 9 } })));
  expect(screen.getByText('3 and 0')).toBeTruthy();
  rerender(
    <NodeChangeCountsProvider roadmapId="other" enabled>
      <Nodes />
    </NodeChangeCountsProvider>,
  );
  expect(screen.getByText('unknown and unknown')).toBeTruthy();
  await screen.findByText('0 and 1');
});

test('opening a changed Node reviews it once, and later arrivals stay marked until reopened', async () => {
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

  counts = { ...counts, first: 1 };
  act(() => window.dispatchEvent(new Event(OWN_INBOX_REFRESH_EVENT)));
  await screen.findByText('1 and 1');
  expect(reviews).toHaveLength(1);

  rerender(view(null));
  rerender(view('first'));
  await screen.findByText('0 and 1');
  expect(reviews).toHaveLength(2);
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
