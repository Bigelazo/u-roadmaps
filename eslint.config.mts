import js from '@eslint/js';
import css from '@eslint/css';
import { fixupPluginRules } from '@eslint/compat';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextConfig from 'eslint-config-next';
import nextTypeScript from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import prettier from 'eslint-config-prettier/flat';
import neverthrow from 'eslint-plugin-neverthrow';
import playwright from 'eslint-plugin-playwright';
import testingLibrary from 'eslint-plugin-testing-library';
import vitest from '@vitest/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import { globSync, readFileSync } from 'node:fs';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];
const architecturalFiles = [
  'src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,css}',
  'tests/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  'scripts/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  'prisma/seed.ts',
];

const clientComponentFiles = globSync('src/**/*.{ts,tsx}').filter((file) =>
  /^['"]use client['"]/.test(readFileSync(file, 'utf8')),
);

const publicEntrypoints = ['index.ts', 'server.ts'];
const featureEntrypoints = { type: 'feature', fileInternalPath: publicEntrypoints };
const integrationEntrypoint = { type: 'integration', fileInternalPath: 'server.ts' };

const restrictedPrismaImports = [
  {
    group: ['@/generated/prisma/**'],
    message: 'Import generated Prisma only through @/shared/server/db.',
  },
];

export default defineConfig([
  globalIgnores([
    '.agents/**',
    '.claude/**',
    '.worktrees/**',
    '.next/**',
    '.next-e2e/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'playwright-report/**',
    'src/generated/prisma/**',
    'test-results/**',
    'uploads/**',
    'uploads-e2e/**',
  ]),
  {
    ...js.configs.recommended,
    files: sourceFiles,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: architecturalFiles,
    ignores: ['src/instrumentation.ts', 'src/proxy.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': [
        ...architecturalFiles,
        'src/generated/prisma/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['feature'],
          partialMatch: false,
        },
        {
          type: 'integration',
          pattern: 'src/integrations/*',
          capture: ['integration'],
          partialMatch: false,
        },
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        { type: 'development', pattern: 'src/development', partialMatch: false },
        { type: 'generated', pattern: 'src/generated/prisma', partialMatch: false },
        { type: 'declaration', pattern: 'src/types', partialMatch: false },
        { type: 'test', pattern: 'tests', partialMatch: false },
        { type: 'entrypoint', pattern: 'scripts', partialMatch: false },
        { type: 'entrypoint', pattern: 'prisma', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          checkUnknownLocals: true,
          policies: [
            {
              from: { element: { type: 'app' } },
              allow: [
                { to: { element: { type: ['app', 'shared', 'declaration'] } } },
                {
                  to: {
                    element: {
                      type: ['feature', 'development'],
                      fileInternalPath: publicEntrypoints,
                    },
                  },
                },
                { to: { element: integrationEntrypoint } },
              ],
            },
            {
              from: { element: { type: 'feature' } },
              allow: [
                { to: { element: { type: 'shared' } } },
                { to: { element: integrationEntrypoint } },
                {
                  to: {
                    element: {
                      type: 'feature',
                      captured: { feature: '{{from.element.captured.feature}}' },
                    },
                  },
                },
              ],
            },
            {
              from: {
                element: {
                  type: 'feature',
                  captured: { feature: ['roadmap', 'academic-overview'] },
                },
              },
              allow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: { feature: 'notifications' },
                    fileInternalPath: 'client.ts',
                  },
                },
              },
            },
            {
              from: {
                element: {
                  type: 'feature',
                  captured: { feature: 'notifications' },
                  fileInternalPath: 'server.ts',
                },
              },
              allow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: { feature: 'roadmap' },
                    fileInternalPath: 'access.ts',
                  },
                },
              },
            },
            {
              from: { element: { type: 'integration' } },
              allow: [
                { to: { element: { type: 'shared' } } },
                {
                  to: {
                    element: {
                      type: 'integration',
                      captured: { integration: '{{from.element.captured.integration}}' },
                    },
                  },
                },
              ],
            },
            {
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: ['shared', 'declaration'] } } },
            },
            {
              from: { element: { type: 'shared', fileInternalPath: 'server/db/**' } },
              allow: { to: { element: { type: 'generated' } } },
            },
            {
              from: { element: { type: 'development' } },
              allow: [
                { to: { element: { type: ['development', 'shared'] } } },
                { to: { element: featureEntrypoints } },
              ],
            },
            {
              from: { element: { type: 'entrypoint' } },
              allow: [
                { to: { element: { type: ['development', 'shared'] } } },
                { to: { element: integrationEntrypoint } },
                { to: { element: featureEntrypoints } },
              ],
            },
            {
              from: { element: { type: 'test' } },
              allow: {
                to: {
                  element: {
                    type: ['app', 'feature', 'integration', 'shared', 'development', 'declaration'],
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      'src/development/**/*.{ts,tsx}',
      'scripts/**/*.ts',
      'prisma/seed.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...restrictedPrismaImports,
            {
              group: ['@/features/*/*', '!@/features/*/server'],
              message: 'Import a feature through its public index.ts or server.ts Interface.',
            },
            {
              group: ['@/integrations/*/*', '!@/integrations/*/server'],
              message: 'Import an integration through its public server.ts Interface.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}', 'scripts/**/*.ts', 'prisma/seed.ts'],
    ignores: ['src/shared/server/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: restrictedPrismaImports }],
    },
  },
  {
    files: clientComponentFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...restrictedPrismaImports,
            {
              group: [
                '@/shared/server/**',
                '@/features/*/server',
                '@/integrations/*/server',
                '@/development/server',
              ],
              message: 'Client Components must not import server-only code.',
            },
          ],
        },
      ],
    },
  },
  ...nextConfig,
  ...nextTypeScript,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'prisma/**/*.ts'],
    plugins: { neverthrow: fixupPluginRules(neverthrow) },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: neverthrow.configs.recommended.rules,
  },
  {
    files: ['tests/**/*.test.{ts,tsx}'],
    ...vitest.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...vitest.environments.env.globals,
      },
    },
  },
  {
    files: ['tests/app/{api,_adapters}/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['@/shared/errors/server', '@/app/_adapters/http'].flatMap((module) => {
          const call =
            "CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/]";
          return [
            `${call}[arguments.0.value='${module}']`,
            `${call}[arguments.0.type='ImportExpression'][arguments.0.source.value='${module}']`,
          ].map((selector) => ({
            selector,
            message: 'HTTP contracts must retain real error normalization and HTTP serialization.',
          }));
        }),
      ],
    },
  },
  {
    files: ['tests/notifications-integration/**/*.test.ts'],
    settings: { vitest: { vitestImports: ['./fixtures'] } },
  },
  {
    files: [
      'tests/features/roadmap/change-port-operations.test.ts',
      'tests/features/roadmap/stored-file-ownership.test.ts',
      'tests/features/roadmap/participant-access.test.ts',
      'tests/features/roadmap/preview-version.test.ts',
      'tests/features/roadmap/resource-access.test.ts',
      'tests/features/roadmap/roadmap-command.test.ts',
    ],
    settings: { vitest: { vitestImports: ['../../notifications-integration/fixtures'] } },
  },
  {
    files: ['tests/features/roadmap/application/academic-participation.test.ts'],
    settings: { vitest: { vitestImports: ['../../../notifications-integration/fixtures'] } },
  },
  {
    files: ['tests/**/*.test.tsx'],
    ...testingLibrary.configs['flat/react'],
  },
  {
    files: ['tests/e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/expect-expect': ['warn', { assertFunctionNames: ['ok'] }],
    },
  },
  {
    files: ['**/*.css'],
    language: 'css/css',
    ...css.configs.recommended,
    rules: {
      ...css.configs.recommended.rules,
      'css/no-important': 'off',
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
      'css/use-baseline': 'off',
    },
  },
  prettier,
]);
