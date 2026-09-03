import js from '@eslint/js';
import css from '@eslint/css';
import { fixupPluginRules } from '@eslint/compat';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextConfig from 'eslint-config-next';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import neverthrow from 'eslint-plugin-neverthrow';
import playwright from 'eslint-plugin-playwright';
import testingLibrary from 'eslint-plugin-testing-library';
import vitest from '@vitest/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const sourceFiles = ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];

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
