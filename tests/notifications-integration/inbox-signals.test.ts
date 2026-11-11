import { expect } from 'vitest';
import { test } from './fixtures';
import { integrationClient, integrationDatabaseUrl } from './database';
import { addNode, enterRoadmap, teacherEdits } from './roadmap';

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
    await client.query('SELECT 1');
    return received.length;
  } finally {
    await client.end();
  }
}

test('notice writes no longer signal the recipient Inbox in real time', async ({ course }) => {
  const node = await addNode(course, 'Colas');
  const edits = teacherEdits(course);
  expect(await inboxSignals(course.studentId, () => edits.rename(node.id, 'Pilas'))).toBe(0);
  expect(
    await inboxSignals(course.studentId, () => enterRoadmap(course.studentId, course.roadmapId)),
  ).toBe(0);
  const created = await edits.create('Grafos');
  expect(await inboxSignals(course.studentId, () => edits.remove(created.id))).toBe(0);
});
