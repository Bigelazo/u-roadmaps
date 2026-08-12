import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const predefinedTypes = [
  { id: '00000000-0000-4000-8000-000000000001', nombre: 'Contenido', color: '#024AD8' },
  { id: '00000000-0000-4000-8000-000000000002', nombre: 'Evaluación', color: '#FF5050' },
  { id: '00000000-0000-4000-8000-000000000003', nombre: 'Material extra', color: '#356373' },
];

async function main() {
  for (const tipo of predefinedTypes) {
    await prisma.tipoNodo.upsert({
      where: { id: tipo.id },
      update: {
        nombre: tipo.nombre,
        nombreNormalizado: tipo.nombre.trim().toLocaleLowerCase('es-CL'),
        color: tipo.color,
        predefinido: true,
        roadmapId: null,
      },
      create: {
        ...tipo,
        nombreNormalizado: tipo.nombre.trim().toLocaleLowerCase('es-CL'),
        predefinido: true,
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
