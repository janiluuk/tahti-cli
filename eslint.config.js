import js from '@eslint/js';
import prettierPlugin from 'eslint-plugin-prettier/recommended';
import { globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config([
  globalIgnores(['dist/**', 'coverage/**', 'node_modules/**']),
  {
    files: ['**/*.{js,ts}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  tseslint.configs.recommended,
  prettierPlugin,
  {
    files: ['**/*.{js,ts}'],
    rules: {
      curly: ['error', 'all'],
    },
  },
]);
