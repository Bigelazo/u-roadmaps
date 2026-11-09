import { localFixtureUCampus } from '@/integrations/ucampus/server';
import 'dotenv/config';
import { mkdtempSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, expect, vi } from 'vitest';
import {
  student,
  teacher,
  test,
  type IntegrationCourse,
} from '../../notifications-integration/fixtures';

const session = vi.hoisted(() => ({ userId: '' }));
vi.mock('@/app/_adapters/auth', () => ({
  requireAuthenticatedUser: async () => ({
    id: session.userId,
    rut: null,
    ucampus: localFixtureUCampus,
  }),
}));

const directory = mkdtempSync(join(tmpdir(), 'resource-access-'));
process.env.UPLOADS_DIRECTORY = relative(process.cwd(), directory);
const {
  completeNode,
  completeSimulatedNode,
  downloadRoadmapResource,
  readRoadmapForParticipant,
  readSimulatedRoadmap,
  recordCanvasPreviewResourceReview,
  recordLinkResourceAccess,
  replaceRoadmapResourceFile,
  resetSimulatedCompletions,
  uploadRoadmapResource,
  backfillResourceFileSizes,
} = await import('@/features/roadmap/server');
const { POST: accessRoute } =
  await import('@/app/api/[courseCode]/[year]/[semester]/roadmap/resources/[resourceId]/access/route');
const { POST: completionRoute } =
  await import('@/app/api/[courseCode]/[year]/[semester]/roadmap/nodes/[nodeId]/completion/route');
const { createRoadmap } = await import('@/features/roadmap/application/roadmap');
const { prisma } = await import('@/shared/server/db');
const { recordingChangePort } = await import('./support/recording-change-port');
const port = () => recordingChangePort().port;

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

function classmate(course: IntegrationCourse) {
  return { userId: course.classmateId, identifier: course.identifier };
}

async function fileResource(course: IntegrationCourse, content = 'Contenido') {
  return uploadRoadmapResource(
    { ...teacher(course), id: course.change.nodeId, file: new File([content], 'guia.txt') },
    port(),
  );
}

async function linkResource(course: IntegrationCourse) {
  return prisma.resource.create({
    data: {
      roadmapNodeId: course.change.nodeId,
      title: 'Video',
      url: 'https://example.com/video',
      type: 'LINK',
    },
  });
}

const download = (
  participant: { userId: string; identifier: IntegrationCourse['identifier'] },
  resourceId: string,
) => downloadRoadmapResource({ ...participant, resourceId }, port());

async function studentResource(
  course: IntegrationCourse,
  resourceId: string,
  userId = course.studentId,
) {
  const roadmap = await readRoadmapForParticipant({ userId, identifier: course.identifier });
  return roadmap.nodes
    .flatMap((node) => ('resources' in node ? node.resources : []))
    .find(({ id }) => id === resourceId);
}

function courseRequest(course: IntegrationCourse, userId: string, params: Record<string, string>) {
  session.userId = userId;
  return [
    new Request('http://localhost/roadmap', { method: 'POST' }),
    {
      params: Promise.resolve({
        courseCode: course.identifier.courseCode,
        year: String(course.identifier.year),
        semester: String(course.identifier.semester),
        ...params,
      }),
    },
  ] as const;
}

test('every student download counts, while teaching staff and closed Roadmaps record nothing', async ({
  course,
}) => {
  const resource = await fileResource(course);

  await download(student(course), resource.id);
  await download(student(course), resource.id);
  await download(classmate(course), resource.id);
  await download(teacher(course), resource.id);

  expect(await studentResource(course, resource.id)).toMatchObject({
    accessCount: 3,
    isReviewed: true,
    fileSize: 9,
  });
  const teaching = await readRoadmapForParticipant(teacher(course));
  expect(teaching.nodes.flatMap((node) => ('resources' in node ? node.resources : []))).toEqual([
    expect.objectContaining({ id: resource.id, accessCount: 3 }),
  ]);
  expect(await prisma.resourceAccess.count({ where: { userId: course.teacherId } })).toBe(0);

  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  await download(student(course), resource.id);
  expect(await studentResource(course, resource.id)).toMatchObject({ accessCount: 3 });
});

test('opening a Link records an access for the student, never for teaching staff or a File', async ({
  course,
}) => {
  const link = await linkResource(course);
  const file = await fileResource(course);

  expect(
    (await accessRoute(...courseRequest(course, course.studentId, { resourceId: link.id }))).status,
  ).toBe(204);
  expect(await studentResource(course, link.id)).toMatchObject({
    accessCount: 1,
    isReviewed: true,
  });
  expect(await studentResource(course, link.id, course.classmateId)).toMatchObject({
    accessCount: 1,
    isReviewed: false,
  });

  expect(
    (await accessRoute(...courseRequest(course, course.teacherId, { resourceId: link.id }))).status,
  ).toBe(403);
  await expect(
    recordLinkResourceAccess({ ...student(course), resourceId: file.id }, port()),
  ).rejects.toMatchObject({ status: 400 });
  expect(await studentResource(course, link.id)).toMatchObject({ accessCount: 1 });
  expect(await studentResource(course, file.id)).toMatchObject({
    accessCount: 0,
    isReviewed: false,
  });
});

test('replacing a File resets every student review and keeps the access count', async ({
  course,
}) => {
  const resource = await fileResource(course);
  await download(student(course), resource.id);
  await download(classmate(course), resource.id);
  await recordCanvasPreviewResourceReview({ ...teacher(course), resourceId: resource.id }, port());

  await replaceRoadmapResourceFile(
    {
      ...teacher(course),
      id: resource.id,
      file: new File(['Nueva versión'], 'guia.pdf'),
      title: 'Guía',
    },
    port(),
  );

  expect(await studentResource(course, resource.id)).toMatchObject({
    accessCount: 2,
    isReviewed: false,
    fileSize: 14,
  });
  expect(await studentResource(course, resource.id, course.classmateId)).toMatchObject({
    isReviewed: false,
  });
  const preview = await readSimulatedRoadmap(teacher(course));
  expect(preview.nodes.flatMap((node) => ('resources' in node ? node.resources : []))).toEqual([
    expect.objectContaining({ isReviewed: false }),
  ]);
  await download(student(course), resource.id);
  expect(await studentResource(course, resource.id)).toMatchObject({
    accessCount: 3,
    isReviewed: true,
  });
});

test('a Completion needs every current Resource reviewed, and later Resources keep it', async ({
  course,
}) => {
  const file = await fileResource(course);
  const link = await linkResource(course);
  const nodeId = course.change.nodeId;

  const refused = await completionRoute(...courseRequest(course, course.studentId, { nodeId }));
  expect(refused.status).toBe(409);
  expect(await refused.json()).toMatchObject({
    error: {
      code: 'UNREVIEWED_RESOURCES',
      message: 'Revisa todos los recursos de este nodo antes de completarlo.',
    },
  });
  await download(student(course), file.id);
  await expect(completeNode({ ...student(course), nodeId }, port())).rejects.toMatchObject({
    code: 'UNREVIEWED_RESOURCES',
  });
  await recordLinkResourceAccess({ ...student(course), resourceId: link.id }, port());
  const completion = await completeNode({ ...student(course), nodeId }, port());

  await linkResource(course);
  await expect(completeNode({ ...student(course), nodeId }, port())).resolves.toMatchObject({
    id: completion.id,
    completedAt: completion.completedAt,
  });
  expect(
    (await readRoadmapForParticipant(student(course))).nodes.find(({ id }) => id === nodeId),
  ).toMatchObject({ isCompleted: true });
});

test('a Canvas preview Completion needs simulated reviews that never count and reset with the preview', async ({
  course,
}) => {
  const link = await linkResource(course);
  const nodeId = course.change.nodeId;
  const editor = teacher(course);

  await expect(completeSimulatedNode({ ...editor, nodeId }, port())).rejects.toMatchObject({
    status: 409,
    code: 'UNREVIEWED_RESOURCES',
  });
  await recordCanvasPreviewResourceReview({ ...editor, resourceId: link.id }, port());
  await recordCanvasPreviewResourceReview({ ...editor, resourceId: link.id }, port());
  await completeSimulatedNode({ ...editor, nodeId }, port());

  expect(await studentResource(course, link.id)).toMatchObject({
    accessCount: 0,
    isReviewed: false,
  });
  await resetSimulatedCompletions(editor, port());
  const preview = await readSimulatedRoadmap(editor);
  expect(preview.nodes.find(({ id }) => id === nodeId)).toMatchObject({
    isCompleted: false,
    resources: [expect.objectContaining({ isReviewed: false })],
  });
  await expect(
    recordCanvasPreviewResourceReview({ ...student(course), resourceId: link.id }, port()),
  ).rejects.toMatchObject({ status: 403 });
});

test('a Roadmap copy carries file sizes but starts without accesses or reviews', async ({
  course,
}) => {
  const resource = await fileResource(course);
  await download(student(course), resource.id);
  await prisma.roadmap.update({ where: { id: course.roadmapId }, data: { closedAt: new Date() } });
  const next = { ...course.identifier, year: 2027, semester: 1 };
  const { roadmap } = await createRoadmap(
    next,
    { source: course.identifier },
    { id: course.teacherId },
    port(),
  );

  const [copied] = await prisma.resource.findMany({
    where: { roadmapNode: { roadmapId: roadmap.id } },
    include: { accesses: true },
  });
  expect(copied).toMatchObject({ fileSize: 9, accesses: [] });
});

test('the file size backfill measures stored files and leaves missing ones unknown', async ({
  course,
}) => {
  const measured = await fileResource(course, 'Doce bytes!!');
  const missing = await fileResource(course);
  await prisma.resource.updateMany({
    where: { id: { in: [measured.id, missing.id] } },
    data: { fileSize: null },
  });
  const missingKey = (await prisma.resource.findUniqueOrThrow({ where: { id: missing.id } }))
    .fileKey!;
  await rm(join(directory, missingKey));
  const stored = await prisma.resource.findUniqueOrThrow({ where: { id: measured.id } });
  await writeFile(join(directory, stored.fileKey!), 'Ahora son diecinueve');

  const result = await backfillResourceFileSizes();

  expect(result.missing).toContain(missing.id);
  expect(
    await prisma.resource.findMany({
      where: { id: { in: [measured.id, missing.id] } },
      select: { id: true, fileSize: true },
      orderBy: { fileSize: 'asc' },
    }),
  ).toEqual(
    expect.arrayContaining([
      { id: measured.id, fileSize: 20 },
      { id: missing.id, fileSize: null },
    ]),
  );
});
