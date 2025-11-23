module.exports = {
  root: true,
  ignorePatterns: [
    'node_modules',
    'dist',
    '.next',
    'coverage',
  ],
  overrides: [
    {
      // Next.js apps
      files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
      extends: ['next/core-web-vitals'],
    },
    {
      // NestJS apps and worker
      files: ['apps/api/**/*.ts', 'apps/worker/**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      parserOptions: {
        project: ['./apps/api/tsconfig.json', './apps/worker/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
    {
      // Shared libraries
      files: ['libs/**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ],
};