// @vitest-environment node
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, afterAll, expect, test } from 'vitest';
import { Client } from 'pg';
import { integrationDatabaseUrl } from '../notifications-integration/database';
import { resourceContentState } from '@/shared/server/resource-content-state';

const migrationName = '20261018000000_resource_file_link';
const migrations = new URL('../../prisma/migrations/', import.meta.url);
const databaseName = `resource_upgrade_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString: integrationDatabaseUrl() });
const destination = new URL(integrationDatabaseUrl());
destination.pathname = `/${databaseName}`;
const sql = new Client({ connectionString: destination.toString() });
let migration = '';
let uploadedDirectory: string;
const previousDatabase = process.env.DATABASE_URL;
let prisma: (typeof import('@/shared/server/db'))['prisma'];
const ids = {
  user: randomUUID(),
  teacher: randomUUID(),
  offering: randomUUID(),
  roadmap: randomUUID(),
  node: randomUUID(),
  type: randomUUID(),
};
const title = 'Guía "ñ" \\ prueba\n\t\b\f\r\u0001 😀';
const date = new Date('2026-10-01T12:34:56.123Z');
type LegacyResource = {
  id: string;
  title: string;
  url: string;
  type: string;
  fileKey: string | null;
  fileContentType: string | null;
};
function state(resource: LegacyResource, changes: Partial<LegacyResource> = {}) {
  return JSON.stringify(resourceContentState({ ...resource, ...changes }));
}
const normalized = (resource: LegacyResource, changes: Partial<LegacyResource> = {}) =>
  state(resource, {
    type: resource.fileKey ? 'FILE' : 'LINK',
    fileContentType: resource.fileKey ? resource.fileContentType : null,
    ...changes,
  });

beforeAll(async () => {
  uploadedDirectory = await mkdtemp(join(tmpdir(), 'resource-upgrade-bytes-'));
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await sql.connect();
  for (const name of (await readdir(migrations))
    .filter((name) => name < migrationName && name !== 'migration_lock.toml')
    .sort())
    await sql.query(await readFile(new URL(`${name}/migration.sql`, migrations), 'utf8'));
  migration = await readFile(new URL(`${migrationName}/migration.sql`, migrations), 'utf8').catch(
    () => '',
  );
  process.env.DATABASE_URL = destination.toString();
  ({ prisma } = await import('@/shared/server/db'));
  await prisma.user.createMany({
    data: [ids.user, ids.teacher].map((id) => ({
      id,
      name: 'Upgrade',
      institutionalEmail: `${id}@upgrade.test`,
      rut: id.slice(0, 20),
    })),
  });
  await prisma.course.create({ data: { code: 'UPGRADE', name: 'Upgrade', department: 'Test' } });
  await prisma.courseOffering.create({
    data: { id: ids.offering, courseCode: 'UPGRADE', year: 2026, semester: 2 },
  });
  await prisma.roadmap.create({ data: { id: ids.roadmap, courseOfferingId: ids.offering } });
  await prisma.participation.createMany({
    data: [
      { userId: ids.user, courseOfferingId: ids.offering, role: 'STUDENT' },
      { userId: ids.teacher, courseOfferingId: ids.offering, role: 'TEACHER' },
    ],
  });
  await prisma.nodeType.create({
    data: {
      id: ids.type,
      name: 'Tema',
      normalizedName: 'tema',
      icon: 'BookOpen',
      color: '#024AD8',
      roadmapId: ids.roadmap,
    },
  });
  await prisma.roadmapNode.create({
    data: {
      id: ids.node,
      title: 'Nodo',
      roadmapId: ids.roadmap,
      nodeTypeId: ids.type,
      positionX: 0,
      positionY: 0,
    },
  });
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  process.env.DATABASE_URL = previousDatabase;
  await sql.end();
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
  await rm(uploadedDirectory, { recursive: true, force: true });
});

async function resource(
  type = 'VIDEO',
  fileKey: string | null = null,
  fileContentType: string | null = null,
) {
  const row = {
    id: randomUUID(),
    title,
    url: 'https://example.test/ñ?a="b"',
    type,
    fileKey,
    fileContentType,
  };
  await sql.query(
    `INSERT INTO "Resource" (id,"roadmapNodeId",title,url,type,"fileKey","fileContentType","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [row.id, ids.node, row.title, row.url, type, fileKey, fileContentType, date],
  );
  return row;
}
async function known(row: LegacyResource, knownValue: string, currentValue: string | null = null) {
  await prisma.noticeKnownValue.create({
    data: {
      recipientId: ids.user,
      roadmapId: ids.roadmap,
      noticeTarget: 'resource',
      targetKey: `resource:${row.id}`,
      nodeId: ids.node,
      knownValue,
      currentValue,
      context: { untouched: 'ñ' },
    },
  });
}
async function notice(
  row: LegacyResource,
  knownValue: string,
  currentValue: string,
  acknowledgedAt: Date | null = null,
) {
  return prisma.roadmapNotice.create({
    data: {
      id: randomUUID(),
      eventId: randomUUID(),
      targetKey: `resource:${row.id}`,
      recipientId: ids.user,
      roadmapId: ids.roadmap,
      courseOfferingId: ids.offering,
      subject: 'cached',
      body: 'cached',
      occurredAt: date,
      availableAt: date,
      acknowledgedAt,
      data: {
        noticeTarget: 'resource',
        noticeClass: 'roadmap-resource-changed',
        targetKey: `resource:${row.id}`,
        nodeId: ids.node,
        knownValue,
        currentValue,
        context: { resourceId: row.id, nodeTitle: 'Nodo' },
        legacy: { keep: true },
      },
    },
  });
}

test('upgrade normalizes ownership and translates only proven encoded revisions atomically', async () => {
  const video = await resource();
  const external = await resource('FILE', null, 'application/pdf');
  const stored = await resource('VIDEO', randomUUID(), 'application/pdf');
  const retainedBytes = Buffer.from('Retained original bytes \0 ñ');
  await writeFile(join(uploadedDirectory, stored.fileKey!), retainedBytes, { flag: 'wx' });
  const validLink = await resource('LINK');
  const validFile = await resource('FILE', randomUUID(), 'application/pdf');
  const storedLink = await resource('LINK', randomUUID(), null);
  const oldTitle = 'Título anterior "\\"\n 😀';
  await known(video, state(video), state(video));
  await known(external, state(external, { title: oldTitle }), state(external));
  await known(stored, state(stored), null);
  await known(validLink, state(validLink, { type: 'VIDEO' }));
  await known(validFile, state(validFile, { type: 'LINK' }));
  const opaque = state(storedLink, { url: 'https://example.test/old' });
  await known(storedLink, opaque, state(storedLink));
  const typeOnly = await notice(video, state(video, { type: 'LINK' }), state(video));
  const titleChange = await notice(external, state(external, { title: oldTitle }), state(external));
  const urlChange = await notice(storedLink, opaque, state(storedLink));
  const acknowledged = await notice(
    validLink,
    state(validLink, { type: 'VIDEO' }),
    state(validLink),
    date,
  );
  const removed = await resource();
  await known(removed, state(removed), 'null');
  await notice(removed, state(removed), 'null');
  const deleted = await resource();
  await known(deleted, state(deleted), 'null');
  const deletedNotice = await notice(deleted, state(deleted), 'null');
  await sql.query('DELETE FROM "Resource" WHERE id=$1', [deleted.id]);
  const added = await resource();
  await known(added, 'null', state(added));
  await notice(added, 'null', state(added));
  const broad = await prisma.roadmapNotice.create({
    data: {
      eventId: randomUUID(),
      targetKey: `node-created:${ids.node}`,
      recipientId: ids.user,
      roadmapId: ids.roadmap,
      courseOfferingId: ids.offering,
      subject: 'broad',
      body: 'broad',
      occurredAt: date,
      data: {
        noticeTarget: 'node-created',
        context: { resources: [{ id: video.id, title }] },
        knownValue: 'absent',
        currentValue: 'present',
      },
    },
  });
  await prisma.noticeKnownValue.create({
    data: {
      recipientId: ids.user,
      roadmapId: ids.roadmap,
      noticeTarget: 'node-title',
      targetKey: `node-title:${ids.node}`,
      nodeId: ids.node,
      knownValue: '"Nodo"',
      context: {},
    },
  });
  // Unknown/malformed identities must neither abort the upgrade nor acquire a guessed baseline.
  const malformedTargets = ['resource:not-a-uuid', `resource:${video.id.replaceAll('-', '')}`];
  const malformedKnown = await Promise.all(
    malformedTargets.map((targetKey) =>
      prisma.noticeKnownValue.create({
        data: {
          recipientId: ids.user,
          roadmapId: ids.roadmap,
          noticeTarget: 'resource',
          targetKey,
          nodeId: ids.node,
          knownValue: state(video),
          currentValue: state(video),
          context: { untouched: 'ñ' },
        },
      }),
    ),
  );
  const malformedSnapshots = malformedTargets.map((targetKey) => ({
    id: null,
    noticeTarget: 'resource',
    targetKey,
    nodeId: ids.node,
    currentValue: state(video),
  }));
  const operationId = randomUUID();
  const snapshot = {
    id: titleChange.id,
    noticeTarget: 'resource',
    targetKey: `resource:${external.id}`,
    nodeId: ids.node,
    currentValue: state(external),
    onlyPending: true,
    context: { resourceId: external.id, untouched: 'ñ' },
  };
  const missingTarget = {
    id: null,
    targetKey: `resource:${video.id}`,
    currentValue: state(video),
    unrelated: true,
  };
  const typeSnapshot = {
    ...snapshot,
    id: typeOnly.id,
    targetKey: `resource:${video.id}`,
    currentValue: state(video),
    context: { resourceId: video.id },
  };
  const unrelated = {
    id: null,
    noticeTarget: 'node-title',
    targetKey: `node-title:${ids.node}`,
    nodeId: ids.node,
    currentValue: '"Nodo"',
    onlyPending: true,
  };
  const opening = await prisma.noticeAcknowledgement.create({
    data: {
      recipientId: ids.user,
      operationId,
      roadmapId: ids.roadmap,
      openedAt: date,
      snapshots: [snapshot, typeSnapshot, unrelated],
      summary: { keep: 'captured text' },
    },
  });
  const recognizedOpening = await prisma.noticeAcknowledgement.create({
    data: {
      recipientId: ids.user,
      roadmapId: ids.roadmap,
      openedAt: date,
      summary: { keep: 'captured text' },
      operationId: randomUUID(),
      snapshots: [snapshot, unrelated, missingTarget, ...malformedSnapshots],
      recognizedAt: date,
    },
  });
  await prisma.noticeDeliveryEffect.create({ data: { eventId: 'receipt', recipientId: ids.user } });
  await prisma.roadmapVisit.create({
    data: { recipientId: ids.user, roadmapId: ids.roadmap, lastRecognizedOpeningSequence: 0 },
  });
  await prisma.nodeChangeReview.create({
    data: { recipientId: ids.user, nodeId: ids.node, reviewedAt: date },
  });
  // The same migration must also preserve frozen editions and every original timestamp/URL.
  await prisma.roadmap.update({ where: { id: ids.roadmap }, data: { closedAt: date } });
  // A late failure must roll back schema, material and all notice stores together.
  const beforeFailure = await sql.query(`SELECT jsonb_build_object(
    'resources', (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM "Resource" r),
    'known', (SELECT jsonb_agg(to_jsonb(k) ORDER BY "targetKey") FROM "NoticeKnownValue" k),
    'notices', (SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM "RoadmapNotice" n),
    'openings', (SELECT jsonb_agg(to_jsonb(a) ORDER BY "operationId") FROM "NoticeAcknowledgement" a)) AS state`);
  await expect(
    sql.query(migration.replace('COMMIT;', 'SELECT 1 / 0; COMMIT;')),
  ).rejects.toMatchObject({ code: '22012' });
  await sql.query('ROLLBACK');
  const afterFailure = await sql.query(`SELECT jsonb_build_object(
    'resources', (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM "Resource" r),
    'known', (SELECT jsonb_agg(to_jsonb(k) ORDER BY "targetKey") FROM "NoticeKnownValue" k),
    'notices', (SELECT jsonb_agg(to_jsonb(n) ORDER BY id) FROM "RoadmapNotice" n),
    'openings', (SELECT jsonb_agg(to_jsonb(a) ORDER BY "operationId") FROM "NoticeAcknowledgement" a)) AS state`);
  expect(afterFailure.rows).toEqual(beforeFailure.rows);
  expect(
    (
      await sql.query(
        `SELECT enumlabel FROM pg_enum WHERE enumtypid='"ResourceType"'::regtype ORDER BY enumsortorder`,
      )
    ).rows.map((row) => row.enumlabel),
  ).toEqual(['FILE', 'LINK', 'VIDEO']);
  await sql.query(migration);
  const rows = (await sql.query('SELECT * FROM "Resource"')).rows;
  for (const row of [video, external, stored, validLink, validFile, storedLink, removed, added]) {
    expect(rows.find((entry) => entry.id === row.id)).toMatchObject({
      ...row,
      roadmapNodeId: ids.node,
      type: row.fileKey ? 'FILE' : 'LINK',
      fileContentType: row.fileKey ? row.fileContentType : null,
      createdAt: date,
      updatedAt: date,
    });
  }
  expect(await readFile(join(uploadedDirectory, stored.fileKey!))).toEqual(retainedBytes);
  expect(await prisma.roadmap.findUniqueOrThrow({ where: { id: ids.roadmap } })).toMatchObject({
    closedAt: date,
  });
  const values = await prisma.noticeKnownValue.findMany({ where: { noticeTarget: 'resource' } });
  for (const before of malformedKnown)
    expect(values.find((entry) => entry.targetKey === before.targetKey)).toEqual(before);
  const value = (row: LegacyResource) =>
    values.find((entry) => entry.targetKey === `resource:${row.id}`)!;
  expect(value(video)).toMatchObject({
    knownValue: normalized(video),
    currentValue: normalized(video),
    context: { untouched: 'ñ' },
  });
  expect(value(external)).toMatchObject({
    knownValue: normalized(external, { title: oldTitle }),
    currentValue: normalized(external),
  });
  expect(value(validLink).knownValue).toBe(normalized(validLink));
  expect(value(validFile).knownValue).toBe(normalized(validFile));
  expect(value(stored)).toMatchObject({ knownValue: normalized(stored), currentValue: null });
  expect(value(storedLink)).toMatchObject({
    knownValue: opaque,
    currentValue: normalized(storedLink),
  });
  expect(value(deleted)).toMatchObject({ knownValue: state(deleted), currentValue: 'null' });
  expect(value(added)).toMatchObject({ knownValue: 'null', currentValue: normalized(added) });
  expect(value(removed)).toMatchObject({ knownValue: normalized(removed), currentValue: 'null' });
  expect(await prisma.roadmapNotice.findUnique({ where: { id: typeOnly.id } })).toBeNull();
  for (const before of [titleChange, urlChange, acknowledged, deletedNotice, broad]) {
    const after = await prisma.roadmapNotice.findUniqueOrThrow({ where: { id: before.id } });
    expect({ ...after, data: before.data }).toEqual(before);
  }
  expect(await prisma.roadmapNotice.findUniqueOrThrow({ where: { id: broad.id } })).toEqual(broad);
  expect(
    await prisma.noticeKnownValue.findFirstOrThrow({ where: { noticeTarget: 'node-title' } }),
  ).toMatchObject({ knownValue: '"Nodo"', currentValue: null, context: {} });
  expect(
    (await prisma.roadmapNotice.findUniqueOrThrow({ where: { id: titleChange.id } })).data,
  ).toMatchObject({
    knownValue: normalized(external, { title: oldTitle }),
    currentValue: normalized(external),
    legacy: { keep: true },
  });
  expect(
    (await prisma.roadmapNotice.findUniqueOrThrow({ where: { id: urlChange.id } })).data,
  ).toMatchObject({ knownValue: opaque, currentValue: normalized(storedLink) });
  expect(
    (await prisma.roadmapNotice.findUniqueOrThrow({ where: { id: acknowledged.id } })).data,
  ).toMatchObject({ knownValue: normalized(validLink), currentValue: normalized(validLink) });
  const capture = await prisma.noticeAcknowledgement.findUniqueOrThrow({
    where: { recipientId_operationId: { recipientId: ids.user, operationId } },
  });
  expect(capture).toEqual({
    ...opening,
    snapshots: [
      { ...snapshot, currentValue: normalized(external) },
      { ...typeSnapshot, currentValue: normalized(video) },
      unrelated,
    ],
  });
  expect(
    await prisma.noticeAcknowledgement.findUniqueOrThrow({
      where: {
        recipientId_operationId: {
          recipientId: ids.user,
          operationId: recognizedOpening.operationId,
        },
      },
    }),
  ).toEqual({
    ...recognizedOpening,
    snapshots: [
      { ...snapshot, currentValue: normalized(external) },
      unrelated,
      missingTarget,
      ...malformedSnapshots,
    ],
  });
  expect(await prisma.noticeDeliveryEffect.count()).toBe(1);
  expect(await prisma.nodeChangeReview.findFirst()).toMatchObject({ reviewedAt: date });
  expect(await prisma.roadmapVisit.findFirst()).toMatchObject({
    lastRecognizedOpeningSequence: BigInt(0),
  });
  expect(await prisma.roadmapNotice.count()).toBe(7); // only the type-only notice withdrew
  // PostgreSQL protects both ownership directions after conversion.
  for (const [kind, key, contentType] of [
    ['FILE', null, null],
    ['LINK', randomUUID(), null],
    ['LINK', null, 'application/pdf'],
  ])
    await expect(
      sql.query('UPDATE "Resource" SET type=$1,"fileKey"=$2,"fileContentType"=$3 WHERE id=$4', [
        kind,
        key,
        contentType,
        video.id,
      ]),
    ).rejects.toMatchObject({ code: '23514' });
  await expect(
    sql.query('UPDATE "Resource" SET type=\'VIDEO\' WHERE id=$1', [video.id]),
  ).rejects.toMatchObject({ code: '22P02' });
  // Recognize the pre-migration capture after a later genuine edit, using the public lifecycle.
  await prisma.roadmap.update({ where: { id: ids.roadmap }, data: { closedAt: null } });
  const { updateRoadmapResource } = await import('@/features/roadmap/server');
  const { recordRoadmapNotices, acknowledgeOwnNotices, listOwnNotices } =
    await import('@/features/notifications/server');
  const port = {
    async report(
      tx: Parameters<typeof recordRoadmapNotices>[0],
      changes: Parameters<typeof recordRoadmapNotices>[1],
    ) {
      const deliver = await recordRoadmapNotices(tx, changes);
      return deliver ? () => deliver((persist) => persist()) : undefined;
    },
  };
  const actor = {
    userId: ids.teacher,
    identifier: { courseCode: 'UPGRADE', year: 2026, semester: 2 },
  };
  await updateRoadmapResource(
    { ...actor, id: validLink.id, input: { title: 'Changed after migration' } },
    port,
  );
  await updateRoadmapResource(
    { ...actor, id: validLink.id, input: { title: validLink.title } },
    port,
  );
  expect(
    await prisma.roadmapNotice.count({
      where: { targetKey: `resource:${validLink.id}`, acknowledgedAt: null },
    }),
  ).toBe(0);
  await updateRoadmapResource(
    {
      userId: ids.teacher,
      identifier: { courseCode: 'UPGRADE', year: 2026, semester: 2 },
      id: external.id,
      input: { title: 'Later edit' },
    },
    port,
  );
  await acknowledgeOwnNotices(ids.user, { roadmapId: ids.roadmap, operationId });
  const notices = await listOwnNotices(ids.user, new URLSearchParams());
  expect(JSON.stringify(notices)).toContain('Later edit');
  expect(
    (
      await prisma.noticeKnownValue.findUniqueOrThrow({
        where: {
          recipientId_roadmapId_targetKey: {
            recipientId: ids.user,
            roadmapId: ids.roadmap,
            targetKey: `resource:${external.id}`,
          },
        },
      })
    ).knownValue,
  ).toBe(normalized(external));
}, 60_000);
