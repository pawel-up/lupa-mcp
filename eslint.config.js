import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import { includeIgnoreFile } from '@eslint/compat'
import { fileURLToPath } from 'node:url'

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url))

/**
 * List of files that must be ignored globally
 */
export const GLOBAL_IGNORE_LIST = [
  '.github/',
  '.husky/',
  '.vscode/*',
  'dist/*',
  'coverage/*',
  'node_modules',
  'eslint.config.js',
  '*.min.*',
  '*.d.ts',
  'CHANGELOG.md',
  'LICENSE*',
  'coverage/**',
  'package-lock.json',
  '.agents'
]

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: GLOBAL_IGNORE_LIST,
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  eslintPluginPrettierRecommended,
  includeIgnoreFile(gitignorePath),
  {
    files: ['**/*.ts'],
    languageOptions: {
      sourceType: 'module',
    },
    rules: {
      'max-len': [
        'error',
        {
          code: 120,
          comments: 120,
          ignoreUrls: true,
          ignoreTemplateLiterals: true,
        },
      ],
      'no-unreachable': ['error'],
      'no-multi-spaces': ['error'],
      'no-console': ['error'],
      'no-redeclare': ['error'],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        "args": "all",
        "argsIgnorePattern": "^_",
        "caughtErrors": "all",
        "caughtErrorsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "ignoreRestSiblings": true
      }],
      '@typescript-eslint/no-explicit-any': 'off', // for now...
      '@typescript-eslint/prefer-literal-enum-member': ['error', {
        allowBitwiseExpressions: true,
      }],
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off'
    },
  },
]
