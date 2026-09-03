import { ESLint } from 'eslint';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, expect, test } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mts' });

async function ruleIdsFor(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: resolve(filePath) });
  return result.messages.flatMap((message) => (message.ruleId ? [message.ruleId] : []));
}

test.each([
  {
    name: 'app imports a feature implementation instead of its public Interface',
    code: "import '@/features/roadmap/application/editor';",
    filePath: 'src/app/page.tsx',
    ruleId: 'boundaries/dependencies',
  },
  {
    name: 'a feature imports a sibling feature',
    code: "import '@/features/academic-overview/server';",
    filePath: 'src/features/roadmap/application/editor.ts',
    ruleId: 'boundaries/dependencies',
  },
  {
    name: 'generated Prisma bypasses the shared database adapter',
    code: "import '@/generated/prisma/client';",
    filePath: 'src/app/page.tsx',
    ruleId: 'no-restricted-imports',
  },
  {
    name: 'a Client Component imports server-only code',
    code: "import '@/shared/server/session';",
    filePath: 'src/features/roadmap/RoadmapCanvas.tsx',
    ruleId: 'no-restricted-imports',
  },
])(
  '$name',
  async ({ code, filePath, ruleId }) => {
    await expect(ruleIdsFor(code, filePath)).resolves.toContain(ruleId);
  },
  15_000,
);

test('an unclassified source file is rejected', async () => {
  const fixtureDirectory = resolve('src/__boundaries-test__');
  const fixturePath = `${fixtureDirectory}/unknown.ts`;

  await mkdir(fixtureDirectory, { recursive: true });
  await writeFile(fixturePath, 'export const unknown = true;');

  await expect(ruleIdsFor('export const unknown = true;', fixturePath)).resolves.toContain(
    'boundaries/no-unknown-files',
  );
});

afterAll(async () => {
  await rm(resolve('src/__boundaries-test__'), { force: true, recursive: true });
});
