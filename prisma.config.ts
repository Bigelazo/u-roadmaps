import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';

config({ path: `.env.${environment}` });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
