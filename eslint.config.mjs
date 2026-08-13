import { defineConfig, globalIgnores } from 'eslint/config';
import nextConfig from 'eslint-config-next/core-web-vitals';
import nextTypescriptConfig from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-plugin-prettier/recommended';
import tailwindConfig from 'eslint-plugin-tailwindcss';

export default defineConfig([
  ...nextConfig,
  ...nextTypescriptConfig,
  {
    ...tailwindConfig.configs.recommended,
    settings: {
      tailwindcss: {
        cssConfigPath: './src/app/globals.css',
      },
    },
  },
  prettierConfig,
  globalIgnores(['.next/**', 'node_modules/**', 'coverage/**']),
]);
