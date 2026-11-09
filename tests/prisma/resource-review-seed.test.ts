import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { Client } from 'pg';
import { integrationDatabaseUrl } from '../notifications-integration/database';

const migrationName = '20261108000100_seed_resource_reviews';
const migrations = new URL('../../prisma/migrations/', import.meta.url);
const databaseName = `resource_review_seed_${randomUUID().replaceAll('-', '')}`;
const admin = new Client({ connectionString: integrationDatabaseUrl() });
const destination = new URL(integrationDatabaseUrl());
destination.pathname = `/${databaseName}`;
const sql = new Client({ connectionString: destination.toString() });
const ids = {
  student: randomUUID(),
  otherStudent: randomUUID(),
  teacher: randomUUID(),
  studentParticipation: randomUUID(),
  otherStudentParticipation: randomUUID(),
  teacherParticipation: randomUUID(),
  offering: randomUUID(),
  roadmap: randomUUID(),
  type: randomUUID(),
  completedNode: randomUUID(),
  pendingNode: randomUUID(),
  guide: randomUUID(),
  slides: randomUUID(),
  pendingGuide: randomUUID(),
};
let migration = '';

async function insert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  await sql.query(
    `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(',')})
     VALUES (${columns.map((_, index) => `$${index + 1}`).join(',')})`,
    Object.values(row),
  );
}

async function resourceAccesses() {
  const { rows } = await sql.query(
    `SELECT "userId", "resourceId", "accessCount", "isReviewed" FROM "ResourceAccess"`,
  );
  return rows;
}

async function simulatedReviews() {
  const { rows } = await sql.query(
    `SELECT "participationId", "resourceId" FROM "SimulatedResourceReview"`,
  );
  return rows;
}

beforeAll(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await sql.connect();
  for (const name of (await readdir(migrations))
    .filter((name) => name < migrationName && name !== 'migration_lock.toml')
    .sort())
    await sql.query(await readFile(new URL(`${name}/migration.sql`, migrations), 'utf8'));
  migration = await readFile(new URL(`${migrationName}/migration.sql`, migrations), 'utf8');

  for (const id of [ids.student, ids.otherStudent, ids.teacher])
    await insert('User', { id, name: 'Seed', institutionalEmail: `${id}@seed.test` });
  await insert('Course', { code: 'SEED', name: 'Seed', department: 'Test' });
  await insert('CourseOffering', {
    id: ids.offering,
    courseCode: 'SEED',
    year: 2026,
    semester: 2,
  });
  await insert('Roadmap', { id: ids.roadmap, courseOfferingId: ids.offering });
  for (const [id, userId, role] of [
    [ids.studentParticipation, ids.student, 'STUDENT'],
    [ids.otherStudentParticipation, ids.otherStudent, 'STUDENT'],
    [ids.teacherParticipation, ids.teacher, 'TEACHER'],
  ])
    await insert('Participation', { id, userId, courseOfferingId: ids.offering, role });
  await insert('NodeType', {
    id: ids.type,
    name: 'Tema',
    normalizedName: 'tema',
    icon: 'BookOpen',
    color: '#024AD8',
    roadmapId: ids.roadmap,
  });
  for (const id of [ids.completedNode, ids.pendingNode])
    await insert('RoadmapNode', {
      id,
      title: 'Nodo',
      roadmapId: ids.roadmap,
      nodeTypeId: ids.type,
      positionX: 0,
      positionY: 0,
    });
  for (const [id, nodeId] of [
    [ids.guide, ids.completedNode],
    [ids.slides, ids.completedNode],
    [ids.pendingGuide, ids.pendingNode],
  ])
    await insert('Resource', {
      id,
      roadmapNodeId: nodeId,
      title: 'Guía',
      url: 'https://example.test/guide',
      type: 'LINK',
      updatedAt: new Date(),
    });
  for (const userId of [ids.student, ids.teacher])
    await insert('Completion', { id: randomUUID(), userId, roadmapNodeId: ids.completedNode });
  await insert('SimulatedCompletion', {
    id: randomUUID(),
    participationId: ids.teacherParticipation,
    courseOfferingId: ids.offering,
    roadmapId: ids.roadmap,
    roadmapNodeId: ids.completedNode,
  });
  await insert('ResourceAccess', {
    userId: ids.student,
    resourceId: ids.slides,
    accessCount: 3,
    isReviewed: false,
  });
}, 60_000);

afterAll(async () => {
  await sql.end();
  await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.end();
});

test('existing student Completions become Resource reviews that add no accesses, however often the step runs', async () => {
  await sql.query(migration);
  await sql.query(migration);

  expect(await resourceAccesses()).toEqual(
    expect.arrayContaining([
      { userId: ids.student, resourceId: ids.guide, accessCount: 0, isReviewed: true },
      { userId: ids.student, resourceId: ids.slides, accessCount: 3, isReviewed: true },
    ]),
  );
  expect(await resourceAccesses()).toHaveLength(2);
  expect(await simulatedReviews()).toEqual(
    expect.arrayContaining([
      { participationId: ids.teacherParticipation, resourceId: ids.guide },
      { participationId: ids.teacherParticipation, resourceId: ids.slides },
    ]),
  );
  expect(await simulatedReviews()).toHaveLength(2);
  await expect(
    sql.query(`UPDATE "ResourceAccess" SET "accessCount" = -1 WHERE "resourceId" = $1`, [
      ids.guide,
    ]),
  ).rejects.toThrow('ResourceAccess_access_count_check');
});
