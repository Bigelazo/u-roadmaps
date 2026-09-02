import 'server-only';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set to initialize Prisma.');
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaConnectionString?: string;
};

export const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaConnectionString === connectionString
    ? globalForPrisma.prisma
    : new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConnectionString = connectionString;
}
