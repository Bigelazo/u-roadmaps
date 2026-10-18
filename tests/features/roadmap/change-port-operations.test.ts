// @vitest-environment node
import 'dotenv/config';
import '../../notifications-integration/setup';
import databaseSetup from '../../notifications-integration/global-setup';
import { beforeAll, expect } from 'vitest';
import { teacher, test, type IntegrationCourse } from '../../notifications-integration/fixtures';
import { prisma } from '@/shared/server/db';
import { recordingChangePort } from './support/recording-change-port';
import {
  createRoadmapNode,
  updateRoadmapNode,
  createRoadmapDependency,
  deleteRoadmapDependency,
  changeTeacherBlock,
  previewRoadmapDependency,
  previewTeacherBlock,
  releaseScheduledTeacherUnlocks,
  createRoadmapResource,
  uploadRoadmapResource,
  updateRoadmapResource,
  removeRoadmapResource,
  createRoadmapNodeType,
  updateRoadmapNodeType,
  deleteRoadmapNodeType,
  completeNode,
} from '@/features/roadmap/server';
import { createRoadmap } from '@/features/roadmap/application/roadmap';
import { materializeParticipation } from '@/features/roadmap/application/academic-participation';
import { teacherEdits } from '../../notifications-integration/roadmap';

beforeAll(databaseSetup, 60_000);

async function addNode(course: IntegrationCourse, title = 'Pilas') {
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  return prisma.roadmapNode.create({
    data: { roadmapId: course.roadmapId, nodeTypeId: type.id, title, positionX: 10, positionY: 20 },
  });
}

function addNodeType(course: { roadmapId: string }, name: string) {
  return prisma.nodeType.create({
    data: {
      roadmapId: course.roadmapId,
      name,
      normalizedName: name.toLowerCase(),
      icon: 'BookOpen',
      color: '#024AD8',
    },
  });
}

/** Matches a recorded `node-access` fact carrying at least `fields`. */
function access(fields: Record<string, unknown>) {
  return expect.objectContaining({ kind: 'node-access', ...fields });
}

test('node creation and edits report per-object previous values and return plain results', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = teacher(course);
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const node = await createRoadmapNode(
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
  const nextType = await addNodeType(course, 'Ejercicio');
  const updated = await updateRoadmapNode(
    {
      ...input,
      id: node.id,
      input: { title: 'Colas', description: 'Nueva', nodeTypeId: nextType.id },
    },
    recording.port,
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
  await updateRoadmapNode(
    { ...input, id: node.id, input: { positionX: 50, title: 'Colas' } },
    recording.port,
  );
  expect(recording.facts()).toEqual([]);
});

test('description and type edits report previous values and write no notice baselines', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const nextType = await addNodeType(course, 'Taller');
  const nodeId = course.change.nodeId;
  await updateRoadmapNode(
    {
      ...teacher(course),
      id: nodeId,
      input: { description: 'Nueva', nodeTypeId: nextType.id },
    },
    recording.port,
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
  const nodeId = course.change.nodeId;
  const edits = teacherEdits(course, recording.port);
  await edits.update(nodeId, { isVisible: false });
  expect(recording.facts()).toContainEqual({
    kind: 'node-visibility',
    nodeId,
    previous: true,
    current: false,
  });
  expect(recording.facts()).toContainEqual(
    access({
      nodeId,
      recipientId: course.studentId,
      previous: 'Disponible',
      current: 'Retirado',
    }),
  );
  // Access baselines are recorded by the notice lifecycle module through the port.
  expect(await prisma.noticeKnownValue.count({ where: { roadmapId: course.roadmapId } })).toBe(0);
  recording.changes.length = 0;
  await edits.remove(nodeId);
  expect(recording.facts()).toMatchObject([
    {
      kind: 'node-deleted',
      nodeId,
      previous: { title: 'Recursividad', isVisible: false },
      current: null,
    },
  ]);
});

test('Dependencies removed by hiding a Node are reported as removed, with the Node hidden', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const target = await addNode(course, 'Colas');
  const dependency = await prisma.dependency.create({
    data: { sourceNodeId: course.change.nodeId, targetNodeId: target.id },
  });
  await teacherEdits(course, recording.port).update(target.id, { isVisible: false });
  expect(await prisma.dependency.count({ where: { targetNodeId: target.id } })).toBe(0);
  expect(recording.facts().filter(({ kind }) => kind === 'dependency')).toEqual([
    {
      kind: 'dependency',
      dependencyId: dependency.id,
      sourceNodeId: course.change.nodeId,
      targetNodeId: target.id,
      previous: true,
      current: false,
      sourceNode: { title: expect.any(String), isVisible: true },
      targetNode: { title: 'Colas', isVisible: false },
    },
  ]);
});

test('dependencies report the pair and distinct access for each recipient; Completion targets its actor', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = teacher(course);
  const target = await addNode(course);
  const request = {
    ...input,
    input: { sourceNodeId: course.change.nodeId, targetNodeId: target.id },
  };
  const { version } = await previewRoadmapDependency(request);
  const result = await createRoadmapDependency(
    { ...request, previewVersion: version },
    recording.port,
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
      access({
        nodeId: target.id,
        recipientId,
        previous: 'Disponible',
        current: 'Bloqueado',
      }),
    );
  expect(result).not.toHaveProperty('notifications');
  recording.changes.length = 0;
  await completeNode(
    { userId: course.studentId, identifier: input.identifier, nodeId: course.change.nodeId },
    recording.port,
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
  await deleteRoadmapDependency({ ...input, id: result.dependency.id }, recording.port);
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
    const input = { ...teacher(course), id: course.change.nodeId };
    await teacherEdits(course, recording.port).block(input.id);
    expect(recording.facts()).toContainEqual(
      access({
        nodeId: input.id,
        recipientId: course.studentId,
        previous: 'Disponible',
        current: 'Bloqueado',
      }),
    );
    recording.changes.length = 0;
    const preview = await previewTeacherBlock({ ...input, operation });
    await changeTeacherBlock(
      { ...input, operation, previewVersion: preview.version },
      recording.port,
    );
    expect(recording.facts()).toContainEqual(
      access({
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
  await releaseScheduledTeacherUnlocks(recording.port, '2026-10-08');
  expect(recording.facts()).toContainEqual(
    access({
      recipientId: course.studentId,
      previous: 'Bloqueado',
      current: 'Disponible',
    }),
  );
  recording.changes.length = 0;
  await releaseScheduledTeacherUnlocks(recording.port, '2026-10-08');
  expect(recording.facts()).toEqual([]);
});

test('Resource lifecycle reports absence and exact previous content, including uploaded files', async ({
  course,
}) => {
  const recording = recordingChangePort();
  const input = teacher(course);
  const resource = await createRoadmapResource(
    {
      ...input,
      id: course.change.nodeId,
      input: { title: 'Guía', url: 'https://example.test/guide', type: 'LINK' },
    },
    recording.port,
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
  const result = await updateRoadmapResource(
    { ...input, id: resource.id, input: { title: 'Guía nueva' } },
    recording.port,
  );
  const edited = recording.facts()[0];
  expect(edited).toMatchObject({
    kind: 'resource',
    previous: added.current,
    current: { title: 'Guía nueva' },
  });
  expect(result).not.toHaveProperty('notification');
  recording.changes.length = 0;
  await updateRoadmapResource(
    { ...input, id: resource.id, input: { title: 'Guía nueva' } },
    recording.port,
  );
  expect(recording.facts()).toEqual([]);
  await removeRoadmapResource({ ...input, id: resource.id }, recording.port);
  if (edited.kind !== 'resource') throw new Error('Expected Resource edit');
  expect(recording.facts()).toMatchObject([
    { kind: 'resource', previous: edited.current, current: null },
  ]);
  recording.changes.length = 0;
  const file = await uploadRoadmapResource(
    {
      ...input,
      id: course.change.nodeId,
      file: new File(['Contenido'], 'guide.txt', { type: 'text/plain' }),
    },
    recording.port,
  );
  expect(recording.facts()).toMatchObject([
    { kind: 'resource', resourceId: file.id, previous: null, current: { title: 'guide.txt' } },
  ]);
  await removeRoadmapResource({ ...input, id: file.id }, recording.port);
});

test('type rename reports its previous name; appearance edits stay silent', async ({ course }) => {
  const type = await prisma.nodeType.findFirstOrThrow({ where: { roadmapId: course.roadmapId } });
  const recording = recordingChangePort();
  const input = { ...teacher(course), id: type.id };
  const result = await updateRoadmapNodeType(
    { ...input, input: { name: 'Lectura' } },
    recording.port,
  );
  expect(recording.facts()).toEqual([
    { kind: 'node-type-name', nodeTypeId: type.id, previous: 'Tema', current: 'Lectura' },
  ]);
  expect(result).not.toHaveProperty('notification');
  recording.changes.length = 0;
  await updateRoadmapNodeType({ ...input, input: { color: '#1467A8' } }, recording.port);
  expect(recording.facts()).toEqual([]);
});

test('Node type commands refuse what the Node type decision rejects, with their HTTP contract', async ({
  course,
}) => {
  const { port } = recordingChangePort();
  const editor = teacher(course);
  const name = `Predefinido ${crypto.randomUUID()}`;
  const predefined = await prisma.nodeType.create({
    data: {
      name,
      normalizedName: name.toLowerCase(),
      icon: 'BookOpen',
      color: '#024AD8',
      isPredefined: true,
    },
  });
  const appearance = { icon: 'BookOpen', color: '#024AD8' };

  try {
    await expect(
      createRoadmapNodeType(
        { ...editor, input: { name: ` ${name.toUpperCase()} `, ...appearance } },
        port,
      ),
    ).rejects.toMatchObject({ status: 409, code: 'NODE_TYPE_NAME_CONFLICT' });
    await expect(
      createRoadmapNodeType({ ...editor, input: { name: 'TEMA', ...appearance } }, port),
    ).rejects.toMatchObject({ status: 409, code: 'NODE_TYPE_NAME_CONFLICT' });
    await expect(
      updateRoadmapNodeType({ ...editor, id: predefined.id, input: { color: '#1467A8' } }, port),
    ).rejects.toMatchObject({ status: 409, code: 'PREDEFINED_TYPE_IMMUTABLE' });
    await expect(
      deleteRoadmapNodeType({ ...editor, id: predefined.id }, port),
    ).rejects.toMatchObject({ status: 409, code: 'PREDEFINED_TYPE_IMMUTABLE' });
    await expect(
      updateRoadmapNodeType(
        { ...editor, id: crypto.randomUUID(), input: { name: 'Lectura' } },
        port,
      ),
    ).rejects.toMatchObject({ status: 404, code: 'NODE_TYPE_NOT_FOUND' });
    await expect(
      deleteRoadmapNodeType({ ...editor, id: course.nodeTypeId }, port),
    ).rejects.toMatchObject({
      status: 409,
      code: 'NODE_TYPE_IN_USE',
      message: 'No se puede eliminar un tipo utilizado por nodos.',
    });

    const created = await createRoadmapNodeType(
      { ...editor, input: { name: 'Taller', ...appearance } },
      port,
    );
    await updateRoadmapNodeType({ ...editor, id: created.id, input: { name: 'TALLER' } }, port);
    await deleteRoadmapNodeType({ ...editor, id: created.id }, port);
    expect(await prisma.nodeType.count({ where: { roadmapId: course.roadmapId } })).toBe(1);
  } finally {
    await prisma.nodeType.delete({ where: { id: predefined.id } });
  }
});

test('promotion reports the role change', async ({ course }) => {
  const recording = recordingChangePort();
  await materializeParticipation(
    { id: course.studentId, rut: null },
    course.identifier,
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

test('concurrent materializations of one new Course both succeed', async ({ course }) => {
  const courseCode = `RACE${crypto.randomUUID().slice(0, 8)}`;
  const offering = (year: number, semester: number) =>
    materializeParticipation(
      { id: course.studentId, rut: null },
      { courseCode, year, semester },
      { name: 'Curso concurrente', positions: ['STUDENT'] },
      recordingChangePort().port,
    );
  try {
    await Promise.all([offering(2025, 1), offering(2025, 2), offering(2025, 2)]);
    expect(await prisma.courseOffering.count({ where: { courseCode } })).toBe(2);
  } finally {
    await prisma.course.deleteMany({ where: { code: courseCode } });
  }
});

test.for([false, true])(
  'Roadmap creation reports availability (copy: %s)',
  async (copy, { course }) => {
    const recording = recordingChangePort();
    await prisma.roadmap.update({
      where: { id: course.roadmapId },
      data: { closedAt: new Date() },
    });
    const identifier = { ...course.identifier, year: 2027, semester: 1 };
    const result = await createRoadmap(
      identifier,
      copy ? { source: course.identifier } : {},
      { id: course.teacherId, name: 'Docente' },
      recording.port,
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
  const upload = uploadRoadmapResource(
    {
      ...teacher(course),
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
  );
  await expect(upload).rejects.toThrow('transaction failed');
  expect(storedFileKey).toEqual(expect.any(String));
  const { readUploadedFile } =
    await import('@/features/roadmap/infrastructure/resources/filesystem');
  await expect(readUploadedFile(storedFileKey!)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('external creation refuses Files; uploaded Files can only be renamed and Links cannot convert', async ({
  course,
}) => {
  const { port } = recordingChangePort();
  const actor = teacher(course);
  await expect(
    createRoadmapResource(
      {
        ...actor,
        id: course.change.nodeId,
        input: { title: 'External PDF', url: 'https://example.test/a.pdf', type: 'FILE' },
      },
      port,
    ),
  ).rejects.toMatchObject({ status: 400, code: 'INVALID_RESOURCE_TYPE' });
  const link = await createRoadmapResource(
    {
      ...actor,
      id: course.change.nodeId,
      input: { title: 'Video', url: 'https://example.test/video', type: 'LINK' },
    },
    port,
  );
  await expect(
    updateRoadmapResource({ ...actor, id: link.id, input: { type: 'FILE' } }, port),
  ).rejects.toMatchObject({ status: 400, code: 'INVALID_RESOURCE_EDIT' });
  const file = await uploadRoadmapResource(
    {
      ...actor,
      id: course.change.nodeId,
      file: new File(['content'], 'guide.pdf', { type: 'application/pdf' }),
    },
    port,
  );
  try {
    for (const input of [
      { url: 'https://example.test/replaced' },
      { type: 'LINK' },
      { type: 'FILE' },
    ])
      await expect(
        updateRoadmapResource({ ...actor, id: file.id, input }, port),
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_RESOURCE_EDIT' });
    const renamed = await updateRoadmapResource(
      { ...actor, id: file.id, input: { title: 'Renamed.pdf' } },
      port,
    );
    expect(renamed.resource).toMatchObject({ title: 'Renamed.pdf', url: file.url, type: 'FILE' });
    const edited = await updateRoadmapResource(
      {
        ...actor,
        id: link.id,
        input: { title: 'Revised', url: 'https://example.test/revised', type: 'LINK' },
      },
      port,
    );
    expect(edited.resource).toMatchObject({
      title: 'Revised',
      url: 'https://example.test/revised',
      type: 'LINK',
    });
  } finally {
    await removeRoadmapResource({ ...actor, id: file.id }, port);
  }
});
