// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { beforeAll, expect } from 'vitest';
import { test } from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import { recordingChangePort } from './support/recording-change-port';
import {
  createRoadmapNode,
  updateRoadmapNode,
  deleteRoadmapNode,
  createRoadmapDependency,
  deleteRoadmapDependency,
  changeTeacherBlock,
  previewTeacherBlock,
  releaseScheduledTeacherUnlocks,
  createRoadmapResource,
  uploadRoadmapResource,
  updateRoadmapResource,
  removeRoadmapResource,
  updateRoadmapNodeType,
  completeNode,
} from '@/features/roadmap/server';
import { createRoadmap } from '@/features/roadmap/application/roadmap';
import { materializeParticipation } from '@/features/roadmap/application/academic-participation';
import type { ResultAsync } from 'neverthrow';

beforeAll(databaseSetup, 60_000);

function confirmed<T, E>(result: ResultAsync<T, E>) {
  return result.match(
    (value) => value,
    (error) => {
      throw error;
    },
  );
}

function editor(course: {
  teacherId: string;
  change: { courseCode: string; year: number; semester: number };
}) {
  const { courseCode, year, semester } = course.change;
  return { userId: course.teacherId, identifier: { courseCode, year, semester } };
}

async function addNode(
  course: Parameters<typeof editor>[0] & { roadmapId: string },
  title = 'Pilas',
) {
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  return prisma.roadmapNode.create({
    data: { roadmapId: course.roadmapId, nodeTypeId: type.id, title, positionX: 10, positionY: 20 },
  });
}

test('node creation and edits report per-object previous values and return plain results', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = editor(course);
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const node = await confirmed(
    createRoadmapNode(
      {
        ...input,
        input: {
          title: 'Pilas',
          description: 'Original',
          nodeTypeId: type.id,
          positionX: 10,
          positionY: 20,
        },
      },
      recording.port,
    ),
  );
  expect(recording.facts()).toMatchObject([
    {
      kind: 'node-created',
      nodeId: node.id,
      previous: null,
      current: { title: 'Pilas', description: 'Original' },
    },
  ]);
  recording.changes.length = 0;
  const nextType = await prisma.nodeType.create({
    data: {
      roadmapId: course.roadmapId,
      name: 'Ejercicio',
      normalizedName: 'ejercicio',
      icon: 'BookOpen',
      color: '#024AD8',
    },
  });
  const updated = await confirmed(
    updateRoadmapNode(
      {
        ...input,
        id: node.id,
        input: { title: 'Colas', description: 'Nueva', nodeTypeId: nextType.id },
      },
      recording.port,
    ),
  );
  expect(recording.facts()).toEqual([
    { kind: 'node-title', nodeId: node.id, previous: 'Pilas', current: 'Colas' },
    { kind: 'node-description', nodeId: node.id, previous: 'Original', current: 'Nueva' },
    {
      kind: 'node-type',
      nodeId: node.id,
      previous: { id: type.id, name: 'Tema' },
      current: { id: nextType.id, name: 'Ejercicio' },
    },
  ]);
  expect(updated).not.toHaveProperty('notification');
  expect(updated).not.toHaveProperty('notifications');
  recording.changes.length = 0;
  await confirmed(
    updateRoadmapNode(
      { ...input, id: node.id, input: { positionX: 50, title: 'Colas' } },
      recording.port,
    ),
  );
  expect(recording.facts()).toEqual([]);
});

test('description and type edits report previous values and write no notice baselines', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const nextType = await prisma.nodeType.create({
    data: {
      roadmapId: course.roadmapId,
      name: 'Taller',
      normalizedName: 'taller',
      icon: 'BookOpen',
      color: '#024AD8',
    },
  });
  const nodeId = course.change.nodeId;
  await confirmed(
    updateRoadmapNode(
      {
        ...editor(course),
        id: nodeId,
        input: { description: 'Nueva', nodeTypeId: nextType.id },
      },
      recording.port,
    ),
  );
  expect(recording.facts()).toEqual([
    { kind: 'node-description', nodeId, previous: null, current: 'Nueva' },
    {
      kind: 'node-type',
      nodeId,
      previous: { id: type.id, name: 'Tema' },
      current: { id: nextType.id, name: 'Taller' },
    },
  ]);
  // Known values are recorded by the notice lifecycle module through the port.
  expect(await prisma.noticeKnownValue.count({ where: { roadmapId: course.roadmapId } })).toBe(0);
});

test('visibility and deletion report their facts and recipient access transitions', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = editor(course);
  const nodeId = course.change.nodeId;
  await confirmed(
    updateRoadmapNode({ ...input, id: nodeId, input: { isVisible: false } }, recording.port),
  );
  expect(recording.facts()).toContainEqual({
    kind: 'node-visibility',
    nodeId,
    previous: true,
    current: false,
  });
  expect(recording.facts()).toContainEqual(
    expect.objectContaining({
      kind: 'node-access',
      nodeId,
      recipientId: course.studentId,
      previous: 'Disponible',
      current: 'Retirado',
    }),
  );
  // Access baselines are recorded by the notice lifecycle module through the port.
  expect(await prisma.noticeKnownValue.count({ where: { roadmapId: course.roadmapId } })).toBe(0);
  recording.changes.length = 0;
  await confirmed(deleteRoadmapNode({ ...input, id: nodeId }, recording.port));
  expect(recording.facts()).toMatchObject([
    {
      kind: 'node-deleted',
      nodeId,
      previous: { title: 'Recursividad', isVisible: false },
      current: null,
    },
  ]);
});

test('Dependencies removed by hiding a Node are not reported as Dependency facts', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = editor(course);
  const target = await addNode(course);
  await prisma.dependency.create({
    data: { sourceNodeId: course.change.nodeId, targetNodeId: target.id },
  });
  await confirmed(
    updateRoadmapNode({ ...input, id: target.id, input: { isVisible: false } }, recording.port),
  );
  expect(await prisma.dependency.count({ where: { targetNodeId: target.id } })).toBe(0);
  expect(recording.facts().filter(({ kind }) => kind === 'dependency')).toEqual([]);
});

test('dependencies report the pair and distinct access for each recipient; Completion targets its actor', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = editor(course);
  const target = await addNode(course);
  const result = await confirmed(
    createRoadmapDependency(
      { ...input, input: { sourceNodeId: course.change.nodeId, targetNodeId: target.id } },
      recording.port,
    ),
  );
  expect(recording.facts()).toContainEqual(
    expect.objectContaining({
      kind: 'dependency',
      dependencyId: result.dependency.id,
      sourceNodeId: course.change.nodeId,
      targetNodeId: target.id,
      previous: false,
      current: true,
    }),
  );
  expect(
    recording
      .facts()
      .filter((fact) => fact.kind === 'node-access')
      .map((fact) => fact.kind === 'node-access' && fact.recipientId)
      .sort(),
  ).toEqual([course.studentId, course.classmateId].sort());
  for (const recipientId of [course.studentId, course.classmateId])
    expect(recording.facts()).toContainEqual(
      expect.objectContaining({
        kind: 'node-access',
        nodeId: target.id,
        recipientId,
        previous: 'Disponible',
        current: 'Bloqueado',
      }),
    );
  expect(result).not.toHaveProperty('notifications');
  recording.changes.length = 0;
  await confirmed(
    completeNode(
      { userId: course.studentId, identifier: input.identifier, nodeId: course.change.nodeId },
      recording.port,
    ),
  );
  expect(recording.facts()).toEqual([
    {
      kind: 'node-access',
      nodeId: target.id,
      recipientId: course.studentId,
      previous: 'Bloqueado',
      current: 'Disponible',
      nodeTitle: 'Pilas',
      nodeTypeName: 'Tema',
    },
  ]);
  recording.changes.length = 0;
  await confirmed(deleteRoadmapDependency({ ...input, id: result.dependency.id }, recording.port));
  // Only the classmate, who has not completed the prerequisite, regains access.
  expect(recording.facts()).toMatchObject([
    { kind: 'dependency', previous: true, current: false },
    { kind: 'node-access', recipientId: course.classmateId, previous: 'Bloqueado' },
  ]);
});

test.for(['UNBLOCK', 'BRANCH_UNLOCK'] as const)(
  'Teacher block and %s report access changes',
  async (operation, { course }) => {
    const recording = recordingChangePort();
    const input = { ...editor(course), id: course.change.nodeId };
    await confirmed(changeTeacherBlock({ ...input, operation: 'BLOCK' }, recording.port));
    expect(recording.facts()).toContainEqual(
      expect.objectContaining({
        kind: 'node-access',
        nodeId: input.id,
        recipientId: course.studentId,
        previous: 'Disponible',
        current: 'Bloqueado',
      }),
    );
    recording.changes.length = 0;
    const preview = await confirmed(previewTeacherBlock({ ...input, operation }));
    await confirmed(
      changeTeacherBlock({ ...input, operation, previewVersion: preview.version }, recording.port),
    );
    expect(recording.facts()).toContainEqual(
      expect.objectContaining({
        kind: 'node-access',
        recipientId: course.studentId,
        previous: 'Bloqueado',
        current: 'Disponible',
      }),
    );
  },
);

test('scheduled releases report committed access transitions and are idempotent', async ({
  course,
}) => {
  await prisma.roadmapNode.update({
    where: { id: course.change.nodeId },
    data: { isTeacherBlocked: true, teacherUnlockOn: new Date('2026-10-01T00:00:00Z') },
  });
  const recording = recordingChangePort();
  await confirmed(releaseScheduledTeacherUnlocks(recording.port, '2026-10-08'));
  expect(recording.facts()).toContainEqual(
    expect.objectContaining({
      kind: 'node-access',
      recipientId: course.studentId,
      previous: 'Bloqueado',
      current: 'Disponible',
    }),
  );
  recording.changes.length = 0;
  await confirmed(releaseScheduledTeacherUnlocks(recording.port, '2026-10-08'));
  expect(recording.facts()).toEqual([]);
});

test('Resource lifecycle reports absence and exact previous content, including uploaded files', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = editor(course);
  const resource = await confirmed(
    createRoadmapResource(
      {
        ...input,
        id: course.change.nodeId,
        input: { title: 'Guía', url: 'https://example.test/guide', type: 'LINK' },
      },
      recording.port,
    ),
  );
  const added = recording.facts()[0];
  expect(added).toMatchObject({
    kind: 'resource',
    nodeId: course.change.nodeId,
    resourceId: resource.id,
    previous: null,
    current: { title: 'Guía' },
  });
  if (added.kind !== 'resource') throw new Error('Expected Resource change');
  recording.changes.length = 0;
  const result = await confirmed(
    updateRoadmapResource(
      { ...input, id: resource.id, input: { title: 'Guía nueva' } },
      recording.port,
    ),
  );
  const edited = recording.facts()[0];
  expect(edited).toMatchObject({
    kind: 'resource',
    previous: added.current,
    current: { title: 'Guía nueva' },
  });
  expect(result).not.toHaveProperty('notification');
  recording.changes.length = 0;
  await confirmed(
    updateRoadmapResource(
      { ...input, id: resource.id, input: { title: 'Guía nueva' } },
      recording.port,
    ),
  );
  expect(recording.facts()).toEqual([]);
  await confirmed(removeRoadmapResource({ ...input, id: resource.id }, recording.port));
  if (edited.kind !== 'resource') throw new Error('Expected Resource edit');
  expect(recording.facts()).toMatchObject([
    { kind: 'resource', previous: edited.current, current: null },
  ]);
  recording.changes.length = 0;
  const file = await confirmed(
    uploadRoadmapResource(
      {
        ...input,
        id: course.change.nodeId,
        file: new File(['Contenido'], 'guide.txt', { type: 'text/plain' }),
      },
      recording.port,
    ),
  );
  expect(recording.facts()).toMatchObject([
    { kind: 'resource', resourceId: file.id, previous: null, current: { title: 'guide.txt' } },
  ]);
  await confirmed(removeRoadmapResource({ ...input, id: file.id }, recording.port));
});

test('type rename reports its previous name; appearance edits stay silent', async ({ course }) => {
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const recording = recordingChangePort();
  const input = { ...editor(course), id: type.id };
  const result = await confirmed(
    updateRoadmapNodeType({ ...input, input: { name: 'Lectura' } }, recording.port),
  );
  expect(recording.facts()).toEqual([
    { kind: 'node-type-name', nodeTypeId: type.id, previous: 'Tema', current: 'Lectura' },
  ]);
  expect(result).not.toHaveProperty('notification');
  recording.changes.length = 0;
  await confirmed(updateRoadmapNodeType({ ...input, input: { color: '#1467A8' } }, recording.port));
  expect(recording.facts()).toEqual([]);
});

test('promotion reports the role change', async ({ course }) => {
  const recording = recordingChangePort();
  await materializeParticipation(
    { id: course.studentId, rut: null },
    editor(course).identifier,
    { name: 'Curso de prueba', positions: ['COURSE_PROFESSOR'] },
    recording.port,
  );
  expect(recording.facts()).toEqual([
    {
      kind: 'participation-role',
      recipientId: course.studentId,
      previous: 'STUDENT',
      current: 'TEACHER',
    },
  ]);
});

test.for([false, true])(
  'Roadmap creation reports availability (copy: %s)',
  async (copy, { course }) => {
    const recording = recordingChangePort();
    await prisma.roadmap.update({
      where: { id: course.roadmapId },
      data: { closedAt: new Date() },
    });
    const identifier = { ...editor(course).identifier, year: 2027, semester: 1 };
    const result = await confirmed(
      createRoadmap(
        identifier,
        copy ? { source: editor(course).identifier } : {},
        { id: course.teacherId, name: 'Docente' },
        recording.port,
      ),
    );
    expect(recording.facts()).toMatchObject([
      {
        kind: 'roadmap-created',
        previous: null,
        current: { courseName: 'Curso de prueba', actorName: 'Docente' },
      },
    ]);
    expect(recording.changes[0].roadmapId).toBe(result.roadmap.id);
    expect(result).not.toHaveProperty('availabilityNotice');
  },
);

test('a failed uploaded Resource transaction compensates its stored bytes', async ({ course }) => {
  let storedFileKey: string | null = null;
  const result = await uploadRoadmapResource(
    {
      ...editor(course),
      id: course.change.nodeId,
      file: new File(['Contenido'], 'guide.txt', { type: 'text/plain' }),
    },
    {
      async report(transaction, changes) {
        const fact = changes.facts[0];
        if (fact.kind !== 'resource') throw new Error('Expected Resource');
        const resource = await transaction.resource.findUniqueOrThrow({
          where: { id: fact.resourceId },
        });
        storedFileKey = resource.fileKey;
        throw new Error('transaction failed');
      },
    },
  ).match(
    () => {
      throw new Error('Expected failure');
    },
    (error) => error,
  );
  expect(result.code).toBe('INTERNAL_ERROR');
  expect(storedFileKey).toEqual(expect.any(String));
  const { readUploadedFile } =
    await import('@/features/roadmap/infrastructure/resources/filesystem');
  await expect(readUploadedFile(storedFileKey!)).rejects.toMatchObject({ code: 'ENOENT' });
});
