import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config([
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  tseslint.configs.recommended,
  prettierPlugin,
  {
    files: ['**/*.{js,mjs,cjs,ts}'],
    rules: {
      curly: ['error', 'all'],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-nocheck': false, 'ts-ignore': true, 'ts-expect-error': true },
      ],
    },
  },
]);
