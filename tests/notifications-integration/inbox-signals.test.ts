import { expect } from 'vitest';
import { test } from './fixtures';
import { integrationClient, integrationDatabaseUrl } from './database';
import { addNode, enterRoadmap, teacherEdits } from './roadmap';

/** Inbox invalidations (the SSE `inbox` change) the recipient received during `write`. */
async function inboxSignals(recipientId: string, write: () => Promise<unknown>) {
  const client = integrationClient(integrationDatabaseUrl());
  const received: unknown[] = [];
  client.on('notification', ({ payload }) => {
    const change = JSON.parse(payload ?? '{}') as { kind?: string; userId?: string };
    if (change.kind === 'inbox' && change.userId === recipientId) received.push(change);
  });
  await client.connect();
  try {
    await client.query('LISTEN u_roadmaps_changes');
    await write();
    // Notifications are delivered after commit; a round trip flushes them.
    await client.query('SELECT 1');
    return received.length;
  } finally {
    await client.end();
  }
}

test('every notice write of the lifecycle module invalidates the recipient Inbox', async ({
  course,
}) => {
  const node = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  // Create, update in place, withdraw.
  expect(
    await inboxSignals(course.studentId, () => edits.rename(node.id, 'Pilas')),
  ).toBeGreaterThan(0);
  expect(
    await inboxSignals(course.studentId, () => edits.rename(node.id, 'Árboles')),
  ).toBeGreaterThan(0);
  expect(
    await inboxSignals(course.studentId, () => edits.rename(node.id, 'Colas')),
  ).toBeGreaterThan(0);
  // Recognition.
  await edits.rename(node.id, 'Pilas');
  expect(
    await inboxSignals(course.studentId, () => enterRoadmap(course.studentId, course.roadmapId)),
  ).toBeGreaterThan(0);
  // Deletion of a Node the recipient never recognized withdraws its creation notice.
  const created = await edits.create('Grafos');
  expect(await inboxSignals(course.studentId, () => edits.remove(created.id))).toBeGreaterThan(0);
});
