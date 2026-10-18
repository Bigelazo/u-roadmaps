// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import { teacher, test } from '../../notifications-integration/fixtures';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { readdir, rm, readFile } from 'node:fs/promises';

const faults = vi.hoisted(() => ({
  partialUpload: false,
  closeFailure: false,
  collision: false,
  cleanupFailure: false,
  cleanupOne: false,
  cleanupPath: '',
  copyFailure: false,
  lateSource: '',
  fastSource: '',
  lateSettled: false,
}));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return {
    ...fs,
    rm: async (...args: Parameters<typeof fs.rm>) => {
      if (faults.cleanupFailure || String(args[0]) === faults.cleanupPath)
        throw new Error('cleanup disk failure');
      return fs.rm(...args);
    },
    copyFile: async (...args: Parameters<typeof fs.copyFile>) => {
      if (faults.collision) await fs.writeFile(args[1], 'pre-existing bytes', { flag: 'wx' });
      if (faults.copyFailure) {
        if (faults.cleanupOne && !faults.cleanupPath) faults.cleanupPath = String(args[1]);
        await fs.writeFile(args[1], 'partial copy');
        throw new Error('copy disk failure');
      }
      if (String(args[0]).endsWith(faults.fastSource) && faults.fastSource) {
        throw new Error('fast copy failure');
      }
      if (String(args[0]).endsWith(faults.lateSource) && faults.lateSource) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await fs.copyFile(...args);
        faults.lateSettled = true;
        return;
      }
      return fs.copyFile(...args);
    },
    writeFile: async (...args: Parameters<typeof fs.writeFile>) => {
      if (!faults.partialUpload) return fs.writeFile(...args);
      await fs.writeFile(args[0], 'partial', args[2]);
      throw new Error('upload disk failure');
    },
    open: async (...args: Parameters<typeof fs.open>) => {
      if (faults.collision) await fs.writeFile(args[0], 'pre-existing bytes', { flag: 'wx' });
      const handle = await fs.open(...args);
      const close = handle.close.bind(handle);
      handle.close = async () => {
        await close();
        if (faults.closeFailure) throw new Error('close disk failure');
      };
      const write = handle.writeFile.bind(handle);
      handle.writeFile = async (...writeArgs) => {
        if (!faults.partialUpload) return write(...writeArgs);
        await write('partial');
        throw new Error('upload disk failure');
      };
      return handle;
    },
  };
});

const directory = mkdtempSync(join(tmpdir(), 'resource-ownership-'));
process.env.UPLOADS_DIRECTORY = relative(process.cwd(), directory);
const { uploadRoadmapResource } = await import('@/features/roadmap/application/resources/commands');
const { createRoadmap } = await import('@/features/roadmap/application/roadmap');
const { downloadRoadmapResource, getRoadmapNodeResources } =
  await import('@/features/roadmap/application/resources/queries');
const { prisma } = await import('@/shared/server/db');
const { recordingChangePort } = await import('./support/recording-change-port');
beforeAll(databaseSetup, 60_000);
afterEach(async () => {
  Object.assign(faults, {
    partialUpload: false,
    closeFailure: false,
    collision: false,
    cleanupFailure: false,
    cleanupOne: false,
    cleanupPath: '',
    copyFailure: false,
    lateSource: '',
    fastSource: '',
    lateSettled: false,
  });
  vi.restoreAllMocks();
  await Promise.all(
    (await readdir(directory)).map((key) => rm(join(directory, key), { force: true })),
  );
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

test('a partial upload failure removes its provisional bytes', async ({ course }) => {
  faults.partialUpload = true;
  await expect(
    uploadRoadmapResource(
      {
        ...teacher(course),
        id: course.change.nodeId,
        file: new File(['Contenido'], 'guide.txt', { type: 'text/plain' }),
      },
      recordingChangePort().port,
    ),
  ).rejects.toThrow('upload disk failure');
  expect(await readdir(directory)).toEqual([]);
});

async function upload(course: Parameters<typeof teacher>[0], id: string, content = 'Contenido') {
  return uploadRoadmapResource(
    { ...teacher(course), id, file: new File([content], 'guide.txt') },
    recordingChangePort().port,
  );
}

async function copySource(
  course: import('../../notifications-integration/fixtures').IntegrationCourse,
) {
  await upload(course, course.change.nodeId, 'Independent source');
  const keys = await readdir(directory);
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  return {
    keys,
    copy: (port = recordingChangePort().port) =>
      createRoadmap(
        { ...course.identifier, year: 2027, semester: 1 },
        { source: course.identifier },
        { id: course.teacherId },
        port,
      ),
  };
}

test('copy creation collisions preserve pre-existing destination bytes', async ({ course }) => {
  const source = await copySource(course);
  faults.collision = true;
  await expect(source.copy()).rejects.toMatchObject({ code: 'EEXIST' });
  const destination = (await readdir(directory)).find((key) => !source.keys.includes(key));
  expect(destination).toBeDefined();
  expect(await readFile(join(directory, destination!), 'utf8')).toBe('pre-existing bytes');
});

test('registration rollback preserves its primary failure when cleanup also fails', async ({
  course,
}) => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  faults.cleanupFailure = true;
  const primary = new Error('registration refused');
  await expect(
    uploadRoadmapResource(
      {
        ...teacher(course),
        id: course.change.nodeId,
        file: new File(['Contenido'], 'guide.txt'),
      },
      {
        async report() {
          throw primary;
        },
      },
    ),
  ).rejects.toBe(primary);
  const [key] = await readdir(directory);
  expect(await readFile(join(directory, key), 'utf8')).toBe('Contenido');
  expect(warning).toHaveBeenCalledWith(
    'Stored file cleanup failed',
    expect.objectContaining({
      operation: 'upload Resource',
      fileKey: key,
      error: expect.any(Error),
    }),
  );
  expect(
    await getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
  ).toEqual([]);
});

test('failed Roadmap registration compensates independent copied bytes and retains the source', async ({
  course,
}) => {
  const source = await copySource(course);
  await expect(
    source.copy({
      async report() {
        throw new Error('copy registration refused');
      },
    }),
  ).rejects.toThrow('copy registration refused');
  expect(await readdir(directory)).toEqual(source.keys);
  expect(await readFile(join(directory, source.keys[0]), 'utf8')).toBe('Independent source');
});

test('copy waits for late writes before compensating a faster failure', async ({ course }) => {
  await upload(course, course.change.nodeId, 'Second source');
  const source = await copySource(course);
  [faults.fastSource, faults.lateSource] = source.keys;
  await expect(source.copy()).rejects.toThrow('fast copy failure');
  expect(faults.lateSettled).toBe(true);
  expect((await readdir(directory)).sort()).toEqual(source.keys.sort());
});

test('several partially failed copies are all compensated', async ({ course }) => {
  await upload(course, course.change.nodeId, 'Second source');
  const source = await copySource(course);
  faults.copyFailure = true;
  await expect(source.copy()).rejects.toThrow('copy disk failure');
  expect((await readdir(directory)).sort()).toEqual(source.keys.sort());
});

test('a missing source omits its Resource and does not retain an empty destination', async ({
  course,
}) => {
  const source = await copySource(course);
  await rm(join(directory, source.keys[0]));
  const { roadmap } = await source.copy();
  expect(roadmap.id).not.toBe(course.roadmapId);
  expect(await readdir(directory)).toEqual([]);
  // Give the teacher access to the newly created Course offering to observe its public Resources.
  await prisma.participation.create({
    data: { userId: course.teacherId, role: 'TEACHER', courseOfferingId: roadmap.courseOfferingId },
  });
  const { readRoadmapForParticipant } = await import('@/features/roadmap/application/completion');
  const result = await readRoadmapForParticipant({
    ...teacher(course),
    identifier: { ...course.identifier, year: 2027, semester: 1 },
  });
  expect(result.nodes).toHaveLength(1);
  expect(
    await getRoadmapNodeResources({
      ...teacher(course),
      identifier: { ...course.identifier, year: 2027, semester: 1 },
      nodeId: result.nodes[0].id,
    }),
  ).toEqual([]);
});

test('successful uploads and copies retain independent bytes', async ({ course }) => {
  const resource = await upload(course, course.change.nodeId);
  const downloaded = await downloadRoadmapResource({ ...teacher(course), resourceId: resource.id });
  expect(downloaded.bytes.toString()).toBe('Contenido');
  const source = await copySource(course);
  await source.copy();
  const destinations = (await readdir(directory)).filter((key) => !source.keys.includes(key));
  expect(destinations).toHaveLength(2);
  await Promise.all(source.keys.map((key) => rm(join(directory, key))));
  expect(
    (await Promise.all(destinations.map((key) => readFile(join(directory, key), 'utf8')))).sort(),
  ).toEqual(['Contenido', 'Independent source']);
});

test('authorization and closure refusals leave storage empty', async ({ course }) => {
  await expect(
    uploadRoadmapResource(
      {
        ...teacher(course),
        userId: course.studentId,
        id: course.change.nodeId,
        file: new File(['Contenido'], 'guide.txt'),
      },
      recordingChangePort().port,
    ),
  ).rejects.toMatchObject({ status: 403 });
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  await expect(upload(course, course.change.nodeId)).rejects.toMatchObject({
    code: 'ROADMAP_CLOSED',
  });
  expect(await readdir(directory)).toEqual([]);
});

test('a retried upload registration retains the original bytes without repeating file creation', async ({
  course,
}) => {
  let retry = true;
  const result = await uploadRoadmapResource(
    {
      ...teacher(course),
      id: course.change.nodeId,
      file: new File(['Once'], 'guide.txt'),
    },
    {
      async report(tx) {
        if (retry) {
          retry = false;
          // A second filesystem creation would now fail instead of repeating upload I/O.
          faults.collision = true;
          await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.fail_upload_commit() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'retry registration' USING ERRCODE = '40001'; END $$`);
          await tx.$executeRawUnsafe(
            'CREATE TEMP TABLE upload_commit_guard (id int) ON COMMIT DROP',
          );
          await tx.$executeRawUnsafe(`CREATE CONSTRAINT TRIGGER fail_upload_commit AFTER INSERT ON upload_commit_guard
            DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_upload_commit()`);
          await tx.$executeRawUnsafe('INSERT INTO upload_commit_guard VALUES (1)');
        }
      },
    },
  );
  expect(
    (await downloadRoadmapResource({ ...teacher(course), resourceId: result.id })).bytes.toString(),
  ).toBe('Once');
  expect(await readdir(directory)).toHaveLength(1);
  expect(
    await getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
  ).toMatchObject([{ id: result.id }]);
});

test('a failed close does not replace the partial upload failure', async ({ course }) => {
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  faults.partialUpload = true;
  faults.closeFailure = true;
  await expect(upload(course, course.change.nodeId)).rejects.toThrow('upload disk failure');
  expect(await readdir(directory)).toEqual([]);
  expect(warning).toHaveBeenCalledWith(
    'Stored file close failed',
    expect.objectContaining({
      operation: 'upload Resource',
      fileKey: expect.any(String),
      error: expect.any(Error),
    }),
  );
});

test('one cleanup failure does not skip other owned files or replace a copy failure', async ({
  course,
}) => {
  await upload(course, course.change.nodeId, 'Second source');
  const source = await copySource(course);
  faults.copyFailure = true;
  faults.cleanupOne = true;
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await expect(source.copy()).rejects.toThrow('copy disk failure');
  const residual = (await readdir(directory)).filter((key) => !source.keys.includes(key));
  expect(residual).toHaveLength(1);
  expect(await readFile(join(directory, residual[0]), 'utf8')).toBe('partial copy');
  expect(warning).toHaveBeenCalledWith(
    'Stored file cleanup failed',
    expect.objectContaining({
      operation: 'create Roadmap',
      fileKey: residual[0],
      error: expect.any(Error),
    }),
  );
});

test('a close failure after a successful write fails and compensates the upload', async ({
  course,
}) => {
  faults.closeFailure = true;
  await expect(upload(course, course.change.nodeId)).rejects.toThrow('close disk failure');
  expect(await readdir(directory)).toEqual([]);
  expect(
    await getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
  ).toEqual([]);
});
