import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import {
  NodeNoticeCountsProvider,
  useNodeNoticeCount,
} from '@/features/notifications/components/inbox-driver';
import { OWN_INBOX_REFRESH_EVENT } from '@/features/notifications/components/own-realtime';

afterEach(() => vi.unstubAllGlobals());
function Nodes() {
  const first = useNodeNoticeCount('first');
  const second = useNodeNoticeCount('second');
  return (
    <p>
      {first ?? 'unknown'} and {second ?? 'unknown'}
    </p>
  );
}
test('Nodes share one grouped request and preserve known counts through failure and retry', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ count: 5, byNode: { first: 2, second: 3 } }))
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValue(Response.json({ count: 1, byNode: { second: 1 } }));
  vi.stubGlobal('fetch', fetch);
  render(
    <NodeNoticeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeNoticeCountsProvider>,
  );
  await screen.findByText('2 and 3');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe('/api/notifications/counts?roadmapId=roadmap&groupBy=nodeId');
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
    <NodeNoticeCountsProvider roadmapId="roadmap" enabled={false}>
      <Nodes />
    </NodeNoticeCountsProvider>,
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
    .mockResolvedValueOnce(Response.json({ count: 3, byNode: { first: 3 } }))
    .mockResolvedValueOnce(Response.json({ count: 1, byNode: { second: 1 } }));
  vi.stubGlobal('fetch', fetch);
  const { rerender } = render(
    <NodeNoticeCountsProvider roadmapId="roadmap" enabled>
      <Nodes />
    </NodeNoticeCountsProvider>,
  );
  act(() => window.dispatchEvent(new Event(OWN_INBOX_REFRESH_EVENT)));
  await screen.findByText('3 and 0');
  await act(async () => resolveOld(Response.json({ count: 9, byNode: { first: 9 } })));
  expect(screen.getByText('3 and 0')).toBeTruthy();
  rerender(
    <NodeNoticeCountsProvider roadmapId="other" enabled>
      <Nodes />
    </NodeNoticeCountsProvider>,
  );
  expect(screen.getByText('unknown and unknown')).toBeTruthy();
  await screen.findByText('0 and 1');
});
