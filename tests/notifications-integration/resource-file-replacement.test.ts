import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, expect } from 'vitest';
import { test } from './fixtures';

const directory = mkdtempSync(join(tmpdir(), 'resource-replacement-notices-'));
process.env.UPLOADS_DIRECTORY = relative(process.cwd(), directory);
const { enterRoadmap, pendingNotices, teacherEdits } = await import('./roadmap');

afterAll(() => rm(directory, { recursive: true, force: true }));

const resourceNotices = async (userId: string, roadmapId: string) =>
  (await pendingNotices(userId, roadmapId)).filter(
    ({ data }) => (data as { noticeTarget?: string }).noticeTarget === 'resource',
  );

test('a file replacement notifies as a Resource update, naming a title change', async ({
  course,
}) => {
  const edits = teacherEdits(course);
  const resource = await edits.uploadResource(
    course.change.nodeId,
    new File(['Primera'], 'Guía 3.docx', { type: 'application/msword' }),
  );
  await enterRoadmap(course.studentId, course.roadmapId);
  await edits.replaceResourceFile(
    resource.id,
    new File(['Segunda'], 'otra.docx', { type: 'application/msword' }),
    'Guía 3.docx',
  );
  const [replaced] = await resourceNotices(course.studentId, course.roadmapId);
  expect(replaced).toMatchObject({
    subject: 'Guía 3.docx',
    body: 'Se actualizó el recurso «Guía 3.docx» en «Recursividad».',
    data: { noticeClass: 'roadmap-resource-changed', resourceId: resource.id },
  });
  await edits.replaceResourceFile(
    resource.id,
    new File(['Tercera'], 'final.pdf', { type: 'application/pdf' }),
    'Guía 3.pdf',
  );
  expect(await resourceNotices(course.studentId, course.roadmapId)).toMatchObject([
    {
      id: replaced.id,
      body: 'Se actualizó el recurso «Guía 3.docx» en «Recursividad». «Guía 3.docx» ahora se llama «Guía 3.pdf».',
    },
  ]);
  expect(await resourceNotices(course.teacherId, course.roadmapId)).toEqual([]);
});
