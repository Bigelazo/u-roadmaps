import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set to seed the database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const predefinedNodeTypes = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Contenido', color: '#024AD8' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Evaluación', color: '#FF5050' },
  { id: '00000000-0000-4000-8000-000000000003', name: 'Material extra', color: '#356373' },
];

async function main() {
  for (const nodeType of predefinedNodeTypes) {
    await prisma.nodeType.upsert({
      where: { id: nodeType.id },
      update: {
        name: nodeType.name,
        normalizedName: nodeType.name.trim().toLocaleLowerCase('es-CL'),
        color: nodeType.color,
        isPredefined: true,
        roadmapId: null,
      },
      create: {
        ...nodeType,
        normalizedName: nodeType.name.trim().toLocaleLowerCase('es-CL'),
        isPredefined: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
