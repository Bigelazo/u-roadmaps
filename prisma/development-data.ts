import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, ResourceType } from '../src/generated/prisma/client';
import { requireFixtureEnvironment } from '../src/lib/development';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set to load development data.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const ids = {
  programming: '30000000-0000-4000-8000-000000000001',
  calculus: '30000000-0000-4000-8000-000000000002',
  physics: '30000000-0000-4000-8000-000000000003',
  algebra: '30000000-0000-4000-8000-000000000004',
  programmingRoadmap: '40000000-0000-4000-8000-000000000001',
  calculusRoadmap: '40000000-0000-4000-8000-000000000002',
  algebraRoadmap: '40000000-0000-4000-8000-000000000003',
  practiceType: '50000000-0000-4000-8000-000000000001',
};
const fixtureOfferingIds = [ids.programming, ids.calculus, ids.physics, ids.algebra];
const predefinedNodeTypes = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Contenido', color: '#024AD8' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Evaluación', color: '#FF5050' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Material extra', color: '#356373' },
];
const nodeId = (number: number) => `60000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
const studentId = (number: number) =>
  `20000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;

export async function resetDevelopmentData() {
  requireFixtureEnvironment();
  await prisma.$transaction(async (transaction) => {
    await transaction.courseOffering.deleteMany({ where: { id: { in: fixtureOfferingIds } } });
    await transaction.user.deleteMany({
      where: {
        id: {
          in: [
            '10000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000002',
            ...Array.from({ length: 55 }, (_, index) => studentId(index + 1)),
          ],
        },
      },
    });

    await transaction.course.createMany({
      skipDuplicates: true,
      data: [
        {
          code: 'CC1001',
          name: 'Programación I',
          department: 'Departamento de Ciencias de la Computación',
        },
        { code: 'MA1001', name: 'Cálculo I', department: 'Departamento de Ingeniería Matemática' },
        { code: 'FI1001', name: 'Física I', department: 'Departamento de Física' },
        { code: 'MA1002', name: 'Álgebra I', department: 'Departamento de Ingeniería Matemática' },
      ],
    });
    for (const nodeType of predefinedNodeTypes) {
      await transaction.nodeType.upsert({
        where: { id: nodeType.id },
        update: {
          name: nodeType.name,
          normalizedName: nodeType.name.toLocaleLowerCase('es-CL'),
          color: nodeType.color,
          isPredefined: true,
          roadmapId: null,
        },
        create: {
          ...nodeType,
          normalizedName: nodeType.name.toLocaleLowerCase('es-CL'),
          isPredefined: true,
        },
      });
    }
    await transaction.courseOffering.createMany({
      data: [
        { id: ids.programming, courseCode: 'CC1001', year: 2026, semester: 2 },
        { id: ids.calculus, courseCode: 'MA1001', year: 2026, semester: 2 },
        { id: ids.physics, courseCode: 'FI1001', year: 2026, semester: 2 },
        { id: ids.algebra, courseCode: 'MA1002', year: 2026, semester: 1 },
      ],
    });
    await transaction.user.createMany({
      data: [
        {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Ana Pérez',
          institutionalEmail: 'ana.perez@example.test',
          rut: '10000001',
        },
        {
          id: '10000000-0000-4000-8000-000000000002',
          name: 'Bruno Soto',
          institutionalEmail: 'bruno.soto@example.test',
          rut: '10000002',
        },
        ...Array.from({ length: 55 }, (_, index) => ({
          id: studentId(index + 1),
          name: `Estudiante ${String(index + 1).padStart(2, '0')}`,
          institutionalEmail: `estudiante${String(index + 1).padStart(2, '0')}@example.test`,
          rut: `20000${String(index + 1).padStart(3, '0')}`,
        })),
      ],
    });
    await transaction.participation.createMany({
      data: [
        ...['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'].map(
          (userId) => ({
            userId,
            courseOfferingId: ids.programming,
            role: 'TEACHER' as const,
            isActive: true,
          }),
        ),
        ...Array.from({ length: 55 }, (_, index) => ({
          userId: studentId(index + 1),
          courseOfferingId: ids.programming,
          role: 'STUDENT' as const,
          isActive: index < 50,
        })),
        ...[1, 2, 3, 4].flatMap((number) => [
          {
            userId: studentId(number),
            courseOfferingId: ids.calculus,
            role: 'STUDENT' as const,
            isActive: true,
          },
          {
            userId: studentId(number),
            courseOfferingId: ids.physics,
            role: 'STUDENT' as const,
            isActive: true,
          },
          {
            userId: studentId(number),
            courseOfferingId: ids.algebra,
            role: 'STUDENT' as const,
            isActive: true,
          },
        ]),
      ],
    });
    await transaction.roadmap.createMany({
      data: [
        { id: ids.programmingRoadmap, courseOfferingId: ids.programming },
        { id: ids.calculusRoadmap, courseOfferingId: ids.calculus },
        { id: ids.algebraRoadmap, courseOfferingId: ids.algebra },
      ],
    });
    await transaction.nodeType.create({
      data: {
        id: ids.practiceType,
        roadmapId: ids.programmingRoadmap,
        name: 'Práctica',
        normalizedName: 'práctica',
        color: '#6A1B9A',
      },
    });
    const programmingTitles = [
      'Introducción al curso',
      'Variables y tipos',
      'Expresiones',
      'Control de flujo',
      'Funciones',
      'Arreglos',
      'Strings',
      'Estructuras',
      'Archivos',
      'Depuración',
      'Práctica 1',
      'Práctica 2',
      'Laboratorio 1',
      'Laboratorio 2',
      'Control 1',
      'Control 2',
      'Proyecto final',
      'Cierre del curso',
    ];
    await transaction.roadmapNode.createMany({
      data: programmingTitles.map((title, index) => ({
        id: nodeId(index + 1),
        roadmapId: ids.programmingRoadmap,
        nodeTypeId:
          index === 10 || index === 11
            ? ids.practiceType
            : index === 14 || index === 15
              ? '00000000-0000-4000-8000-000000000002'
              : '00000000-0000-4000-8000-000000000001',
        title,
        description: `Material de ${title.toLocaleLowerCase('es-CL')}.`,
        positionX: (index % 5) * 240,
        positionY: Math.floor(index / 5) * 170,
        isVisible: index !== 17,
      })),
    });
    await transaction.dependency.createMany({
      data: Array.from({ length: 17 }, (_, index) => ({
        sourceNodeId: nodeId(index + 1),
        targetNodeId: nodeId(index + 2),
      })).concat([
        { sourceNodeId: nodeId(5), targetNodeId: nodeId(11) },
        { sourceNodeId: nodeId(10), targetNodeId: nodeId(14) },
      ]),
    });
    await transaction.resource.createMany({
      data: [
        {
          roadmapNodeId: nodeId(2),
          title: 'Guía de variables',
          url: 'https://example.test/programacion/variables',
          type: ResourceType.LINK,
        },
        {
          roadmapNodeId: nodeId(5),
          title: 'Video de funciones',
          url: 'https://example.test/programacion/funciones',
          type: ResourceType.VIDEO,
        },
        {
          roadmapNodeId: nodeId(11),
          title: 'Enunciado práctica 1',
          url: 'https://example.test/programacion/practica-1.pdf',
          type: ResourceType.FILE,
        },
      ],
    });
    await transaction.roadmapNode.createMany({
      data: [
        {
          id: nodeId(30),
          roadmapId: ids.calculusRoadmap,
          nodeTypeId: '00000000-0000-4000-8000-000000000001',
          title: 'Límites',
          positionX: 0,
          positionY: 0,
        },
        {
          id: nodeId(31),
          roadmapId: ids.calculusRoadmap,
          nodeTypeId: '00000000-0000-4000-8000-000000000001',
          title: 'Derivadas',
          positionX: 240,
          positionY: 0,
        },
        {
          id: nodeId(32),
          roadmapId: ids.algebraRoadmap,
          nodeTypeId: '00000000-0000-4000-8000-000000000001',
          title: 'Vectores',
          positionX: 0,
          positionY: 0,
        },
        {
          id: nodeId(33),
          roadmapId: ids.algebraRoadmap,
          nodeTypeId: '00000000-0000-4000-8000-000000000001',
          title: 'Matrices',
          positionX: 240,
          positionY: 0,
        },
      ],
    });
    await transaction.dependency.createMany({
      data: [
        { sourceNodeId: nodeId(30), targetNodeId: nodeId(31) },
        { sourceNodeId: nodeId(32), targetNodeId: nodeId(33) },
      ],
    });
    await transaction.completion.createMany({
      data: [
        { userId: studentId(2), roadmapNodeId: nodeId(1) },
        ...[1, 2, 3, 4, 5, 6].map((number) => ({
          userId: studentId(3),
          roadmapNodeId: nodeId(number),
        })),
        ...Array.from({ length: 16 }, (_, index) => ({
          userId: studentId(4),
          roadmapNodeId: nodeId(index + 1),
        })),
      ],
    });
  });
}

async function main() {
  await resetDevelopmentData();
}
if (process.argv[1]?.endsWith('development-data.ts')) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
