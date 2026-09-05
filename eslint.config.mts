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

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];
const architecturalFiles = [
  'src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx,css}',
  'tests/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  'scripts/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
  'prisma/seed.ts',
];

const clientComponentFiles = [
  'src/app/_components/AuthenticationAlert.tsx',
  'src/app/_components/CreateRoadmapButton.tsx',
  'src/app/_components/SessionButton.tsx',
  'src/development/components/DevelopmentBar.tsx',
  'src/features/roadmap/RoadmapCanvas.tsx',
  'src/features/roadmap/RoadmapErrorToast.tsx',
  'src/features/roadmap/useRoadmap.ts',
  'src/features/roadmap/editor/NodeCreator.tsx',
  'src/features/roadmap/editor/RoadmapEditor.tsx',
  'src/features/roadmap/graph/FloatingEdge.tsx',
  'src/features/roadmap/graph/RoadmapGraph.tsx',
  'src/features/roadmap/student/NodeDetail.tsx',
  'src/shared/ui/alert-dialog.tsx',
  'src/shared/ui/checkbox.tsx',
  'src/shared/ui/collapsible.tsx',
  'src/shared/ui/dialog.tsx',
  'src/shared/ui/field.tsx',
  'src/shared/ui/label.tsx',
  'src/shared/ui/select.tsx',
  'src/shared/ui/separator.tsx',
  'src/shared/ui/sheet.tsx',
];

const restrictedPrismaImports = [
  {
    group: ['@/generated/prisma/**'],
    message: 'Import generated Prisma only through @/shared/server/db.',
  },
];

export default defineConfig([
  globalIgnores([
    '.next/**',
    '.next-e2e/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'playwright-report/**',
    'src/generated/prisma/**',
    'test-results/**',
  ]),
  {
    ...js.configs.recommended,
    files: sourceFiles,
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Every manually maintained program file belongs to exactly one architecture
    // zone. Generated Prisma is described so imports can be checked, but is not
    // linted as handwritten source. Schema, migrations, root configuration and
    // E2E browser infrastructure are deliberate tooling exclusions.
    files: architecturalFiles,
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
              allow: {
                to: {
                  element: { type: 'app' },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: { type: ['shared', 'declaration'] },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: { type: 'feature', fileInternalPath: ['index.ts', 'server.ts'] },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: { type: 'integration', fileInternalPath: 'server.ts' },
                },
              },
            },
            {
              from: { element: { type: 'app' } },
              allow: {
                to: {
                  element: { type: 'development', fileInternalPath: ['index.ts', 'server.ts'] },
                },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: {
                  element: { type: 'shared' },
                },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: {
                  element: { type: 'integration', fileInternalPath: 'server.ts' },
                },
              },
            },
            {
              from: { element: { type: 'feature' } },
              allow: {
                to: {
                  element: {
                    type: 'feature',
                    captured: { feature: '{{from.element.captured.feature}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'integration' } },
              allow: {
                to: {
                  element: { type: 'shared' },
                },
              },
            },
            {
              from: { element: { type: 'integration' } },
              allow: {
                to: {
                  element: {
                    type: 'integration',
                    captured: { integration: '{{from.element.captured.integration}}' },
                  },
                },
              },
            },
            {
              from: { element: { type: 'shared' } },
              allow: {
                to: {
                  element: { type: ['shared', 'declaration'] },
                },
              },
            },
            {
              from: { element: { type: 'shared', fileInternalPath: 'server/db/**' } },
              allow: {
                to: {
                  element: { type: 'generated' },
                },
              },
            },
            {
              from: { element: { type: 'development' } },
              allow: {
                to: {
                  element: { type: ['development', 'shared'] },
                },
              },
            },
            {
              from: { element: { type: 'development' } },
              allow: {
                to: {
                  element: { type: 'feature', fileInternalPath: ['index.ts', 'server.ts'] },
                },
              },
            },
            {
              from: { element: { type: 'entrypoint' } },
              allow: {
                to: {
                  element: { type: ['development', 'shared'] },
                },
              },
            },
            {
              // Scheduled scripts are the process boundary for integrations
              // that have no HTTP route, such as the academic-calendar sync.
              from: { element: { type: 'entrypoint' } },
              allow: {
                to: {
                  element: { type: 'integration', fileInternalPath: 'server.ts' },
                },
              },
            },
            {
              from: { element: { type: 'entrypoint' } },
              allow: {
                to: {
                  element: { type: 'feature', fileInternalPath: ['index.ts', 'server.ts'] },
                },
              },
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
    // Public callers must use feature/integration Interfaces, never implementation
    // paths. Boundaries still resolves and enforces the equivalent rule for aliases
    // and relative imports.
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
    // The shared database adapter is the sole permitted generated-Prisma seam.
    files: ['src/shared/server/db/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': 'off',
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
    // Keep the client graph from reaching server-only Interfaces, Prisma, or
    // development-only server code. Server Components may still render clients.
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
    files: ['tests/**/*.test.tsx'],
    ...testingLibrary.configs['flat/react'],
  },
  {
    files: ['tests/e2e/**/*.ts'],
    ...playwright.configs['flat/recommended'],
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
