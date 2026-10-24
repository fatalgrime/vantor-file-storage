import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', '.npm-cache/**', 'next-env.d.ts'] },
  { files: ['src/**/*.ts', 'src/**/*.tsx'], extends: [js.configs.recommended, ...tseslint.configs.recommended], rules: {
    // The existing UI uses flexible metadata records; keep this migration focused
    // on correctness rather than a repository-wide typing/style rewrite.
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/no-require-imports': 'off',
    'no-empty': ['error', { allowEmptyCatch: true }],
  } },
);
