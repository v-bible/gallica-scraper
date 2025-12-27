/* eslint-disable import/no-extraneous-dependencies */
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'out']),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        tsconfigRootDir: __dirname,
        project: ['./tsconfig.node.json', './tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier,
      import: importPlugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      'import/extensions': [
        'warn',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],
      'import/no-extraneous-dependencies': [
        'warn',
        {
          devDependencies: false,
        },
      ],
      'import/no-unresolved': 'warn',
      'import/order': [
        'warn',
        {
          alphabetize: {
            order: 'asc',
          },
        },
      ],
      'import/prefer-default-export': 'off',
      'no-param-reassign': 'off',
      'prefer-destructuring': [
        'warn',
        {
          array: false,
          object: true,
        },
      ],
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
      'sort-imports': [
        'warn',
        {
          ignoreDeclarationSort: true,
        },
      ],
      'spaced-comment': ['warn', 'always', { markers: ['/'] }],
    },
    settings: {
      'import/resolver': { typescript: {} },
    },
  },
]);
