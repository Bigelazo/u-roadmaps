import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { completeNode, readRoadmapForParticipant } from '../src/lib/roadmap-completion';
import { throwApiError } from '../src/lib/roadmap-api';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const suffix = `${Date.now()}-${process.pid}`;
const identifier = { courseCode: `RC${suffix}`.slice(0, 20), year: 2026, semester: 1 };
const predefinedNodeTypeId = '00000000-0000-4000-8000-000000000001';

test.after(() => prisma.$disconnect());

test('student Roadmap interface returns Completion state and conceals hidden Nodes', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Estudiante del módulo Completion',
      institutionalEmail: `completion-${suffix}@uchile.cl`,
      rut: `7${Date.now()}${process.pid}`.slice(0, 20),
    },
  });
  const courseOffering = await prisma.courseOffering.create({
    data: {
      year: identifier.year,
      semester: identifier.semester,
      course: {
        create: { code: identifier.courseCode, name: 'Roadmap Completion', department: 'DCC' },
      },
      roadmap: { create: {} },
      participants: { create: { userId: user.id, role: 'STUDENT' } },
    },
    include: { roadmap: true },
  });
  const roadmapId = courseOffering.roadmap?.id;
  assert.ok(roadmapId);
  const hidden = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Oculto',
      positionX: 0,
      positionY: 0,
      isVisible: false,
    },
  });
  const available = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Disponible',
      positionX: 100,
      positionY: 0,
    },
  });
  const locked = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Bloqueado',
      positionX: 200,
      positionY: 0,
    },
  });
  const completed = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Completado',
      positionX: 300,
      positionY: 0,
    },
  });
  await prisma.dependency.createMany({
    data: [
      { sourceNodeId: hidden.id, targetNodeId: available.id },
      { sourceNodeId: available.id, targetNodeId: locked.id },
    ],
  });
  await prisma.completion.create({ data: { userId: user.id, roadmapNodeId: completed.id } });

  const result = await readRoadmapForParticipant({ userId: user.id, identifier }).match(
    (value) => value,
    throwApiError,
  );

  assert.deepEqual(
    result.nodes.map(({ id, isCompleted, canComplete }) => ({ id, isCompleted, canComplete })),
    [
      { id: locked.id, isCompleted: false, canComplete: false },
      { id: completed.id, isCompleted: true, canComplete: false },
      { id: available.id, isCompleted: false, canComplete: true },
    ],
  );
  assert.equal(result.dependencies.length, 1);
  assert.equal(result.dependencies[0]?.sourceNodeId, available.id);
  assert.equal(result.dependencies[0]?.targetNodeId, locked.id);
  const hiddenError = await completeNode({ userId: user.id, identifier, nodeId: hidden.id }).match(
    () => null,
    (error) => error,
  );
  assert.equal(hiddenError?.code, 'NODE_NOT_FOUND');
});

test('completing a visible Node is idempotent and preserves the original Completion', async () => {
  const idempotentIdentifier = {
    courseCode: `RI${suffix}`.slice(0, 20),
    year: 2026,
    semester: 1,
  };
  const user = await prisma.user.create({
    data: {
      name: 'Estudiante idempotente',
      institutionalEmail: `idempotente-${suffix}@uchile.cl`,
      rut: `8${Date.now()}${process.pid}`.slice(0, 20),
    },
  });
  const courseOffering = await prisma.courseOffering.create({
    data: {
      year: idempotentIdentifier.year,
      semester: idempotentIdentifier.semester,
      course: {
        create: {
          code: idempotentIdentifier.courseCode,
          name: 'Completion idempotente',
          department: 'DCC',
        },
      },
      roadmap: { create: {} },
      participants: { create: { userId: user.id, role: 'STUDENT' } },
    },
    include: { roadmap: true },
  });
  const roadmapId = courseOffering.roadmap?.id;
  assert.ok(roadmapId);
  const node = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Completar una vez',
      positionX: 0,
      positionY: 0,
    },
  });

  const [first, repeated] = await Promise.all([
    completeNode({ userId: user.id, identifier: idempotentIdentifier, nodeId: node.id }).match(
      (value) => value,
      throwApiError,
    ),
    completeNode({ userId: user.id, identifier: idempotentIdentifier, nodeId: node.id }).match(
      (value) => value,
      throwApiError,
    ),
  ]);
  const laterPrerequisite = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Prerequisite posterior',
      positionX: 100,
      positionY: 0,
    },
  });
  await prisma.dependency.create({
    data: { sourceNodeId: laterPrerequisite.id, targetNodeId: node.id },
  });
  const afterRoadmapChange = await completeNode({
    userId: user.id,
    identifier: idempotentIdentifier,
    nodeId: node.id,
  }).match((value) => value, throwApiError);

  assert.equal(repeated.id, first.id);
  assert.deepEqual(repeated.completedAt, first.completedAt);
  assert.equal(afterRoadmapChange.id, first.id);
});

test('Completion requires every visible prerequisite and ignores hidden prerequisites', async () => {
  const prerequisiteIdentifier = {
    courseCode: `RP${suffix}`.slice(0, 20),
    year: 2026,
    semester: 1,
  };
  const user = await prisma.user.create({
    data: {
      name: 'Estudiante con prerequisites',
      institutionalEmail: `prerequisites-${suffix}@uchile.cl`,
      rut: `4${Date.now()}${process.pid}`.slice(0, 20),
    },
  });
  const courseOffering = await prisma.courseOffering.create({
    data: {
      year: prerequisiteIdentifier.year,
      semester: prerequisiteIdentifier.semester,
      course: {
        create: {
          code: prerequisiteIdentifier.courseCode,
          name: 'Completion con prerequisites',
          department: 'DCC',
        },
      },
      roadmap: { create: {} },
      participants: { create: { userId: user.id, role: 'STUDENT' } },
    },
    include: { roadmap: true },
  });
  const roadmapId = courseOffering.roadmap?.id;
  assert.ok(roadmapId);
  const visiblePrerequisite = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Prerequisite visible',
      positionX: 0,
      positionY: 0,
    },
  });
  const hiddenPrerequisite = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Prerequisite oculto',
      positionX: 100,
      positionY: 0,
      isVisible: false,
    },
  });
  const target = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Objetivo',
      positionX: 200,
      positionY: 0,
    },
  });
  await prisma.dependency.createMany({
    data: [
      { sourceNodeId: visiblePrerequisite.id, targetNodeId: target.id },
      { sourceNodeId: hiddenPrerequisite.id, targetNodeId: target.id },
    ],
  });

  const prerequisiteError = await completeNode({
    userId: user.id,
    identifier: prerequisiteIdentifier,
    nodeId: target.id,
  }).match(
    () => null,
    (error) => error,
  );
  assert.equal(prerequisiteError?.code, 'PREREQUISITES_PENDING');
  await completeNode({
    userId: user.id,
    identifier: prerequisiteIdentifier,
    nodeId: visiblePrerequisite.id,
  }).match((value) => value, throwApiError);

  const completion = await completeNode({
    userId: user.id,
    identifier: prerequisiteIdentifier,
    nodeId: target.id,
  }).match((value) => value, throwApiError);
  assert.equal(completion.roadmapNodeId, target.id);
});

test('Completion creation requires an active student Participation', async () => {
  const participationIdentifier = {
    courseCode: `RA${suffix}`.slice(0, 20),
    year: 2026,
    semester: 1,
  };
  const [teacher, inactiveStudent] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Docente sin Completion',
        institutionalEmail: `teacher-completion-${suffix}@uchile.cl`,
        rut: `3${Date.now()}${process.pid}`.slice(0, 20),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Estudiante inactivo',
        institutionalEmail: `inactive-completion-${suffix}@uchile.cl`,
        rut: `2${Date.now()}${process.pid}`.slice(0, 20),
      },
    }),
  ]);
  const courseOffering = await prisma.courseOffering.create({
    data: {
      year: participationIdentifier.year,
      semester: participationIdentifier.semester,
      course: {
        create: {
          code: participationIdentifier.courseCode,
          name: 'Completion por Participation',
          department: 'DCC',
        },
      },
      roadmap: { create: {} },
      participants: {
        create: [
          { userId: teacher.id, role: 'TEACHER' },
          { userId: inactiveStudent.id, role: 'STUDENT', isActive: false },
        ],
      },
    },
    include: { roadmap: true },
  });
  const roadmapId = courseOffering.roadmap?.id;
  assert.ok(roadmapId);
  const node = await prisma.roadmapNode.create({
    data: {
      roadmapId,
      nodeTypeId: predefinedNodeTypeId,
      title: 'Solo estudiantes activos',
      positionX: 0,
      positionY: 0,
    },
  });

  for (const userId of [teacher.id, inactiveStudent.id]) {
    const error = await completeNode({
      userId,
      identifier: participationIdentifier,
      nodeId: node.id,
    }).match(
      () => null,
      (failure) => failure,
    );
    assert.equal(error?.code, 'FORBIDDEN');
  }
});
