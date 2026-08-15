module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['neverthrow'],
  rules: {
    'neverthrow/must-use-result': 'error',
  },
  ignorePatterns: ['.next/', 'node_modules/', 'src/generated/'],
};
