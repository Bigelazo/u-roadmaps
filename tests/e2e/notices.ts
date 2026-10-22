import type { APIRequestContext, Page } from '@playwright/test';
import { insert, literal, sql } from './database';
import { expect, type E2EPrimaryCourseOffering } from './fixtures';

export type StoredTarget = Readonly<{
  noticeTarget: string;
  targetKey: string;
  knownValue: string;
  currentValue: string;
  [key: string]: unknown;
}>;

export async function storeNotices(
  course: E2EPrimaryCourseOffering,
  recipientId: string,
  targets: readonly StoredTarget[],
  availableAt = new Date(),
) {
  const { roadmapId, courseCode, year, semester } = course;
  const rows = targets.map((target) => ({
    id: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    targetKey: target.targetKey,
    recipientId,
    roadmapId,
    courseOfferingId: course.id,
    subject: 'Aviso de prueba',
    body: 'Aviso de prueba',
    data: JSON.stringify({ roadmapId, courseCode, year, semester, context: {}, ...target }),
    occurredAt: availableAt,
    availableAt,
  }));
  await sql(insert('RoadmapNotice', rows));
  return rows.map(({ id }) => id);
}

export async function storeTitleNotices(
  course: E2EPrimaryCourseOffering,
  recipientId: string,
  count: number,
  availableAt?: Date,
) {
  const nodes: { id: string; title: string }[] = JSON.parse(
    await sql(
      `SELECT json_agg(json_build_object('id', id, 'title', title)) FROM (SELECT id, title FROM "RoadmapNode" WHERE "roadmapId" = ${literal(course.roadmapId)} AND "isVisible" ORDER BY id LIMIT ${count}) node;`,
    ),
  );
  expect(nodes).toHaveLength(count);
  const renames = nodes.map(({ id, title }) => ({
    noticeTarget: 'node-title',
    targetKey: `node:${id}:title`,
    nodeId: id,
    knownValue: `Antes ${title}`,
    currentValue: title,
  }));
  return storeNotices(course, recipientId, renames, availableAt);
}

export type StoredNotice = Readonly<{
  id: string;
  subject: string;
  body: string;
  read: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}>;

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

export function pendingNotices(api: APIRequestContext, nodeId: string) {
  return listNotices(api, { nodeId, read: false });
}

export type RoadmapOpening = { roadmapId: string; operationId: string };

export async function prepareOpening(api: APIRequestContext, roadmapId: string) {
  const opening: RoadmapOpening = { roadmapId, operationId: crypto.randomUUID() };
  expect((await api.post('/api/notifications/openings', { data: opening })).status()).toBe(200);
  return opening;
}

export async function acknowledgeOpening(api: APIRequestContext, opening: RoadmapOpening) {
  expect((await api.post('/api/notifications/acknowledge', { data: opening })).status()).toBe(200);
}

export async function recognize(api: APIRequestContext, roadmapId: string) {
  await acknowledgeOpening(api, await prepareOpening(api, roadmapId));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findNode(roadmap: { nodes: any[] }, nodeId: string) {
  const node = roadmap.nodes.find((candidate: { id: string }) => candidate.id === nodeId);
  if (!node) throw new Error(`Node ${nodeId} is not in the Roadmap.`);
  return node;
}

export type StreamFrame = { kind: string; data: { userId: string; courseCode?: string } };
export type StreamWindow = Window & { notificationFrames: StreamFrame[] };

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

export function streamFrames(page: Page) {
  return page.evaluate(() => (window as unknown as StreamWindow).notificationFrames);
}
