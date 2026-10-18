// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { afterAll, afterEach, beforeAll, expect, vi } from 'vitest';
import { teacher, test } from '../../notifications-integration/fixtures';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { readdir, rm, readFile, mkdir } from 'node:fs/promises';

const faults = vi.hoisted(() => ({
  userId: '',
  partialUpload: false,
  closeFailure: false,
  collision: false,
  cleanupFailure: false,
  cleanupOne: false,
  cleanupPath: '',
  cleanupPaths: [] as string[],
  copyFailure: false,
  lateSource: '',
  fastSource: '',
  lateSettled: false,
}));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({ id: faults.userId, rut: null }),
}));
vi.mock('node:fs/promises', async (original) => {
  const fs = await original<typeof import('node:fs/promises')>();
  return {
    ...fs,
    rm: async (...args: Parameters<typeof fs.rm>) => {
      if (
        faults.cleanupFailure ||
        String(args[0]) === faults.cleanupPath ||
        faults.cleanupPaths.includes(String(args[0]))
      )
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
const { uploadRoadmapResource, removeRoadmapResource } =
  await import('@/features/roadmap/application/resources/commands');
const { deleteRoadmapNode, previewNodeDeletion } =
  await import('@/features/roadmap/application/editor');
const { createRoadmap } = await import('@/features/roadmap/application/roadmap');
const { downloadRoadmapResource, getRoadmapNodeResources } =
  await import('@/features/roadmap/application/resources/queries');
const { downloadRoadmapVersionResource } =
  await import('@/features/roadmap/application/version-history');
const { GET: courseDownload } =
  await import('@/app/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]/file/route');
const { GET: versionDownload } =
  await import('@/app/api/[courseCode]/versions/[year]/[semester]/resources/[resourceId]/file/route');
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
    cleanupPaths: [],
    copyFailure: false,
    lateSource: '',
    fastSource: '',
    lateSettled: false,
  });
  vi.restoreAllMocks();
  await Promise.all(
    (await readdir(directory)).map((key) =>
      rm(join(directory, key), { force: true, recursive: true }),
    ),
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

async function downloadResponse(
  version: boolean,
  course: Parameters<typeof teacher>[0],
  resourceId: string,
) {
  faults.userId = course.teacherId;
  return (version ? versionDownload : courseDownload)(
    new Request('http://localhost/resource/file'),
    {
      params: Promise.resolve({
        courseCode: course.identifier.courseCode,
        year: String(course.identifier.year),
        semester: String(course.identifier.semester),
        resourceId,
      }),
    },
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

test('committed Node deletion logs every failed cleanup and still cleans other files', async ({
  course,
}) => {
  for (const content of ['First', 'Second', 'Third'])
    await upload(course, course.change.nodeId, content);
  const keys = await readdir(directory);
  faults.cleanupPaths = keys.slice(0, 2).map((key) => join(directory, key));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { version } = await previewNodeDeletion({ ...teacher(course), id: course.change.nodeId });
  await expect(
    deleteRoadmapNode(
      { ...teacher(course), id: course.change.nodeId, previewVersion: version },
      recordingChangePort().port,
    ),
  ).resolves.toEqual({});
  expect((await readdir(directory)).sort()).toEqual(keys.slice(0, 2).sort());
  await expect(
    getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
  ).rejects.toMatchObject({ code: 'NODE_NOT_FOUND' });
  for (const fileKey of keys.slice(0, 2))
    expect(warning).toHaveBeenCalledWith(
      'Stored file cleanup failed',
      expect.objectContaining({ operation: 'delete Node', fileKey, error: expect.any(Error) }),
    );
});

test('committed Resource deletion remains successful and diagnoses retained bytes', async ({
  course,
}) => {
  const resource = await upload(course, course.change.nodeId);
  const [fileKey] = await readdir(directory);
  faults.cleanupFailure = true;
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await expect(
    removeRoadmapResource({ ...teacher(course), id: resource.id }, recordingChangePort().port),
  ).resolves.toEqual({});
  expect(
    await getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
  ).toEqual([]);
  expect(await readFile(join(directory, fileKey), 'utf8')).toBe('Contenido');
  expect(warning).toHaveBeenCalledWith(
    'Stored file cleanup failed',
    expect.objectContaining({ operation: 'remove Resource', fileKey, error: expect.any(Error) }),
  );
});

for (const version of [false, true]) {
  test(`${version ? 'version history' : 'Course offering'} download preserves operational storage errors for the logged 500 response`, async ({
    course,
  }) => {
    const resource = await upload(course, course.change.nodeId);
    const [key] = await readdir(directory);
    await rm(join(directory, key));
    await mkdir(join(directory, key));
    if (version)
      await prisma.roadmap.update({
        where: { id: course.roadmapId },
        data: { closedAt: new Date() },
      });
    const download = () =>
      version
        ? downloadRoadmapVersionResource(
            { id: course.teacherId, rut: null },
            course.identifier,
            resource.id,
          )
        : downloadRoadmapResource({ ...teacher(course), resourceId: resource.id });
    await expect(download()).rejects.toMatchObject({ code: 'EISDIR' });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await downloadResponse(version, course, resource.id);
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: 'INTERNAL_ERROR' } });
    expect(errorLog).toHaveBeenCalledWith(expect.objectContaining({ code: 'EISDIR' }));
    await rm(join(directory, key), { recursive: true });
  });
}

for (const node of [false, true]) {
  test(`${node ? 'Node' : 'Resource'} deletion rollback retains pre-existing downloadable bytes`, async ({
    course,
  }) => {
    const resource = await upload(course, course.change.nodeId);
    const request = { ...teacher(course), id: node ? course.change.nodeId : resource.id };
    const refusal = {
      async report(tx: import('@/shared/server/db').Prisma.TransactionClient) {
        await tx.$executeRawUnsafe(`CREATE FUNCTION pg_temp.refuse_delete_commit() RETURNS trigger
          LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'deletion commit refused'; END $$`);
        await tx.$executeRawUnsafe('CREATE TEMP TABLE delete_commit_guard (id int) ON COMMIT DROP');
        await tx.$executeRawUnsafe(`CREATE CONSTRAINT TRIGGER refuse_delete_commit AFTER INSERT ON delete_commit_guard
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pg_temp.refuse_delete_commit()`);
        await tx.$executeRawUnsafe('INSERT INTO delete_commit_guard VALUES (1)');
      },
    };
    const { version } = await previewNodeDeletion({ ...teacher(course), id: course.change.nodeId });
    await expect(
      node
        ? deleteRoadmapNode({ ...request, previewVersion: version }, refusal)
        : removeRoadmapResource(request, refusal),
    ).rejects.toThrow('deletion commit refused');
    expect(
      await getRoadmapNodeResources({ ...teacher(course), nodeId: course.change.nodeId }),
    ).toMatchObject([{ id: resource.id }]);
    expect(
      (
        await downloadRoadmapResource({ ...teacher(course), resourceId: resource.id })
      ).bytes.toString(),
    ).toBe('Contenido');
  });

  test(`${node ? 'Node' : 'Resource'} deletion treats absent bytes as already cleaned`, async ({
    course,
  }) => {
    const resource = await upload(course, course.change.nodeId);
    const [key] = await readdir(directory);
    await rm(join(directory, key));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const request = { ...teacher(course), id: node ? course.change.nodeId : resource.id };
    const { version } = await previewNodeDeletion({ ...teacher(course), id: course.change.nodeId });
    await expect(
      node
        ? deleteRoadmapNode({ ...request, previewVersion: version }, recordingChangePort().port)
        : removeRoadmapResource(request, recordingChangePort().port),
    ).resolves.toEqual({});
    await expect(
      downloadRoadmapResource({ ...teacher(course), resourceId: resource.id }),
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(await readdir(directory)).toEqual([]);
    expect(warning).not.toHaveBeenCalled();
  });
}

for (const version of [false, true]) {
  test(`${version ? 'version history' : 'Course offering'} download reports absent bytes as an unlogged 404`, async ({
    course,
  }) => {
    const resource = await upload(course, course.change.nodeId);
    if (version)
      await prisma.roadmap.update({
        where: { id: course.roadmapId },
        data: { closedAt: new Date() },
      });
    const successful = await downloadResponse(version, course, resource.id);
    expect(successful.status).toBe(200);
    expect(await successful.text()).toBe('Contenido');
    expect(Object.fromEntries(successful.headers)).toMatchObject({
      'content-type': 'application/octet-stream',
      'content-length': '9',
      'content-disposition': "attachment; filename*=UTF-8''guide.txt",
      'cache-control': 'private, no-store',
    });
    const [key] = await readdir(directory);
    await rm(join(directory, key));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await downloadResponse(version, course, resource.id);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'RESOURCE_NOT_FOUND' } });
    expect(errorLog).not.toHaveBeenCalled();
  });
}

test('downloads keep participant Node access separate from frozen version teacher access', async ({
  course,
  otherCourse,
}) => {
  const resource = await upload(course, course.change.nodeId);
  const download = (userId: string) =>
    downloadRoadmapResource({ userId, identifier: course.identifier, resourceId: resource.id });
  await expect(download(otherCourse.teacherId)).rejects.toMatchObject({ status: 403 });
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { isVisible: false },
  });
  await expect(download(course.studentId)).rejects.toMatchObject({ code: 'NODE_NOT_FOUND' });
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { isVisible: true, isTeacherBlocked: true },
  });
  await expect(download(course.studentId)).rejects.toMatchObject({ code: 'TEACHER_BLOCK' });
  await expect(
    downloadRoadmapVersionResource(
      { id: course.teacherId, rut: null },
      course.identifier,
      resource.id,
    ),
  ).rejects.toMatchObject({ status: 404 });
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  await expect(
    downloadRoadmapVersionResource(
      { id: course.studentId, rut: null },
      course.identifier,
      resource.id,
    ),
  ).rejects.toMatchObject({ status: 404, code: 'VERSION_NOT_FOUND' });
  expect(
    (
      await downloadRoadmapVersionResource(
        { id: course.teacherId, rut: null },
        course.identifier,
        resource.id,
      )
    ).bytes.toString(),
  ).toBe('Contenido');
  await expect(
    removeRoadmapResource({ ...teacher(course), id: resource.id }, recordingChangePort().port),
  ).rejects.toMatchObject({ code: 'ROADMAP_CLOSED' });
  await prisma.participation.update({
    where: { id: course.participationId },
    data: { isActive: false },
  });
  await expect(download(course.studentId)).rejects.toMatchObject({ status: 403 });
  await prisma.courseOffering.update({
    where: { courseCode_year_semester: course.identifier },
    data: { year: 2027 },
  });
  await prisma.participation.updateMany({
    where: {
      userId: course.teacherId,
      courseOffering: { courseCode: course.identifier.courseCode, year: 2027 },
    },
    data: { isActive: false },
  });
  await prisma.courseOffering.create({
    data: {
      ...course.identifier,
      participants: { create: { userId: course.teacherId, role: 'TEACHER' } },
    },
  });
  await expect(
    downloadRoadmapVersionResource(
      { id: course.teacherId, rut: null },
      { ...course.identifier, year: 2027 },
      resource.id,
    ),
  ).rejects.toMatchObject({ status: 404 });
});
