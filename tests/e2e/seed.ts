import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set to seed E2E data.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const identifiers = {
  teacher: '90000000-0000-4000-8000-000000000001',
  student: '90000000-0000-4000-8000-000000000002',
  roadmap: '90000000-0000-4000-8000-000000000010',
  prerequisite: '90000000-0000-4000-8000-000000000011',
  target: '90000000-0000-4000-8000-000000000012',
};

async function main() {
  await prisma.user.createMany({
    data: [
      {
        id: identifiers.teacher,
        name: 'Docente E2E',
        institutionalEmail: 'docente.e2e@example.test',
        rut: '90000001',
      },
      {
        id: identifiers.student,
        name: 'Estudiante E2E',
        institutionalEmail: 'estudiante.e2e@example.test',
        rut: '90000002',
      },
    ],
  });
  const offering = await prisma.courseOffering.create({
    data: {
      course: { create: { code: 'E2E101', name: 'Curso E2E', department: 'DCC' } },
      year: 2026,
      semester: 1,
      roadmap: { create: { id: identifiers.roadmap } },
      participants: {
        create: [
          { userId: identifiers.teacher, role: 'TEACHER' },
          { userId: identifiers.student, role: 'STUDENT' },
        ],
      },
    },
    include: { roadmap: true },
  });
  if (!offering.roadmap) throw new Error('E2E fixture roadmap was not created.');
  await prisma.roadmapNode.createMany({
    data: [
      {
        id: identifiers.prerequisite,
        roadmapId: offering.roadmap.id,
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        title: 'Fundamentos',
        description: 'Primer contenido del curso.',
        positionX: 0,
        positionY: 0,
      },
      {
        id: identifiers.target,
        roadmapId: offering.roadmap.id,
        nodeTypeId: '00000000-0000-4000-8000-000000000001',
        title: 'Aplicación',
        description: 'Contenido que requiere fundamentos.',
        positionX: 240,
        positionY: 0,
      },
    ],
  });
  await prisma.dependency.create({
    data: { sourceNodeId: identifiers.prerequisite, targetNodeId: identifiers.target },
  });
  await prisma.resource.create({
    data: {
      roadmapNodeId: identifiers.prerequisite,
      title: 'Guía de fundamentos',
      url: 'https://example.test/fundamentos',
      type: 'LINK',
    },
  });
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
