import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from './fixtures';

/** Roadmap notices as `/api/notifications` lists them; `data` depends on the notice kind. */
export type StoredNotice = Readonly<{
  id: string;
  subject: string;
  body: string;
  read: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}>;

/** Lists the recipient's notices, e.g. `{ nodeId, limit: 100 }` or `{ roadmapId, read: false }`. */
export async function listNotices(
  api: APIRequestContext,
  query: Record<string, string | number | boolean>,
) {
  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)]),
  );
  const response = await api.get(`/api/notifications?${search}`);
  expect(response.status()).toBe(200);
  return (await response.json()).notifications as StoredNotice[];
}

/** The recipient's unread notices about one Node. */
export function pendingNotices(api: APIRequestContext, nodeId: string) {
  return listNotices(api, { nodeId, read: false });
}

export type RoadmapOpening = { roadmapId: string; operationId: string };

/** Records that the recipient opened a Roadmap; acknowledge it to recognize its notices. */
export async function prepareOpening(api: APIRequestContext, roadmapId: string) {
  const opening: RoadmapOpening = { roadmapId, operationId: crypto.randomUUID() };
  expect((await api.post('/api/notifications/openings', { data: opening })).status()).toBe(200);
  return opening;
}

export async function acknowledgeOpening(api: APIRequestContext, opening: RoadmapOpening) {
  expect((await api.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(200);
}

/** Opens a Roadmap and acknowledges that opening, recognizing the notices it showed. */
export async function recognize(api: APIRequestContext, roadmapId: string) {
  await acknowledgeOpening(api, await prepareOpening(api, roadmapId));
}

/** The Node with this id in a Roadmap response body; throws when it is missing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findNode(roadmap: { nodes: any[] }, nodeId: string) {
  const node = roadmap.nodes.find((candidate: { id: string }) => candidate.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} is not in the Roadmap.`);
  return node;
}

export type StreamFrame = { kind: string; data: { userId: string; courseCode?: string } };
export type StreamWindow = Window & { notificationFrames: StreamFrame[] };

/** Opens the native notification EventSource in a page and waits for its ready frame. */
export async function openNativeStream(page: Page) {
  await page.goto('/api/notifications/counts');
  await page.evaluate(() => {
    const frames: StreamFrame[] = [];
    (window as unknown as StreamWindow).notificationFrames = frames;
    const source = new EventSource('/api/notifications/stream');
    for (const kind of ['ready', 'inbox', 'roadmap']) {
      source.addEventListener(kind, (event) => {
        frames.push({ kind, data: JSON.parse((event as MessageEvent).data) });
      });
    }
  });
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as StreamWindow).notificationFrames[0]?.kind),
    )
    .toBe('ready');
}

/** Frames received so far by the stream that `openNativeStream` opened in the page. */
export function streamFrames(page: Page) {
  return page.evaluate(() => (window as unknown as StreamWindow).notificationFrames);
}
