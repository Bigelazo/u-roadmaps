import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  createRoadmapDependency,
  createRoadmapNode,
  deleteRoadmapDependency,
} from '../src/lib/roadmap-editor';
import { throwApiError } from '../src/lib/roadmap-api';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const suffix = `${Date.now()}-${process.pid}`;
const identifier = { courseCode: `RE${suffix}`.slice(0, 20), year: 2026, semester: 1 };
const predefinedNodeTypeId = '00000000-0000-4000-8000-000000000001';

test.after(() => prisma.$disconnect());

test('teacher Roadmap editor interface creates a Node in its authorized Roadmap', async () => {
  const user = await prisma.user.create({
    data: {
      name: 'Docente del editor',
      institutionalEmail: `editor-${suffix}@uchile.cl`,
      rut: `6${Date.now()}${process.pid}`.slice(0, 20),
    },
  });
  await prisma.courseOffering.create({
    data: {
      year: identifier.year,
      semester: identifier.semester,
      course: { create: { code: identifier.courseCode, name: 'Editor', department: 'DCC' } },
      roadmap: { create: {} },
      participants: { create: { userId: user.id, role: 'TEACHER' } },
    },
  });

  const node = await createRoadmapNode({
    userId: user.id,
    identifier,
    input: {
      title: 'Introducción',
      nodeTypeId: predefinedNodeTypeId,
      positionX: 20,
      positionY: 40,
    },
  }).match((value) => value, throwApiError);

  assert.deepEqual(node, {
    title: 'Introducción',
    description: null,
    positionX: 20,
    positionY: 40,
    nodeTypeId: predefinedNodeTypeId,
    isVisible: true,
    id: node.id,
  });
});

test('student cannot mutate a Roadmap through the editor interface', async () => {
  const student = await prisma.user.create({
    data: {
      name: 'Estudiante del editor',
      institutionalEmail: `student-editor-${suffix}@uchile.cl`,
      rut: `5${Date.now()}${process.pid}`.slice(0, 20),
    },
  });
  const courseOffering = await prisma.courseOffering.findUniqueOrThrow({
    where: { courseCode_year_semester: identifier },
  });
  await prisma.participation.create({
    data: { userId: student.id, courseOfferingId: courseOffering.id, role: 'STUDENT' },
  });

  const error = await createRoadmapNode({
    userId: student.id,
    identifier,
    input: {
      title: 'No autorizado',
      nodeTypeId: predefinedNodeTypeId,
      positionX: 0,
      positionY: 0,
    },
  }).match(
    () => null,
    (failure) => failure,
  );
  assert.equal(error?.code, 'FORBIDDEN');
});

test('teacher creates and deletes a dependency in its authorized Roadmap', async () => {
  const teacher = await prisma.user.findUniqueOrThrow({
    where: { institutionalEmail: `editor-${suffix}@uchile.cl` },
  });
  const [sourceNode, targetNode] = await Promise.all(
    ['Origen', 'Destino'].map((title, index) =>
      createRoadmapNode({
        userId: teacher.id,
        identifier,
        input: {
          title,
          nodeTypeId: predefinedNodeTypeId,
          positionX: index * 100,
          positionY: 0,
        },
      }).match((value) => value, throwApiError),
    ),
  );
  const dependency = await createRoadmapDependency({
    userId: teacher.id,
    identifier,
    input: {
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceHandle: 'bottom',
      targetHandle: 'top',
    },
  }).match((value) => value, throwApiError);

  assert.deepEqual(
    await prisma.dependency.findUniqueOrThrow({
      where: { id: dependency.id },
      select: { sourceHandle: true, targetHandle: true },
    }),
    { sourceHandle: 'bottom', targetHandle: 'top' },
  );

  await deleteRoadmapDependency({ userId: teacher.id, identifier, id: dependency.id }).match(
    (value) => value,
    throwApiError,
  );

  assert.equal(await prisma.dependency.count({ where: { id: dependency.id } }), 0);
});
