import { ESLint } from 'eslint';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mts' });
const diagnostic = 'HTTP contracts must retain real error normalization and HTTP serialization.';
const modules = ['@/shared/errors/server', '@/app/_adapters/http'];
const forbidden = modules.flatMap((module) =>
  ['mock', 'doMock'].flatMap((method) =>
    [`'${module}'`, `import('${module}')`].map((argument) => ({ method, argument })),
  ),
);

test.each(forbidden)(
  'HTTP contracts reject vi.$method($argument)',
  async ({ method, argument }) => {
    const [result] = await eslint.lintText(
      `import { vi } from 'vitest'; vi.${method}(${argument}, () => ({}));`,
      { filePath: resolve('tests/app/api/contract.test.ts') },
    );
    expect(result.messages.filter((message) => message.fatal)).toEqual([]);
    expect(result.messages).toContainEqual(
      expect.objectContaining({ ruleId: 'no-restricted-syntax', message: diagnostic }),
    );
  },
  15_000,
);

test.each([
  { code: "vi.mock('@/app/_adapters/auth', () => ({}));", path: 'tests/app/api/contract.test.ts' },
  {
    code: "vi.mock('@/shared/server/session', () => ({}));",
    path: 'tests/app/_adapters/contract.test.ts',
  },
  {
    code: "vi.doMock(import('@/features/roadmap/server'), () => ({}));",
    path: 'tests/app/api/contract.test.ts',
  },
  { code: "import '@/app/_adapters/http';", path: 'tests/app/_adapters/contract.test.ts' },
  {
    code: "vi.mock('@/shared/errors/server', () => ({}));",
    path: 'tests/features/roadmap/contract.test.ts',
  },
])('allows $code in $path', async ({ code, path }) => {
  const [result] = await eslint.lintText(`import { vi } from 'vitest'; ${code}`, {
    filePath: resolve(path),
  });
  expect(result.messages.filter((message) => message.fatal)).toEqual([]);
  expect(result.messages.filter((message) => message.message === diagnostic)).toEqual([]);
});
