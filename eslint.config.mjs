import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import * as tsParser from '@typescript-eslint/parser';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      'dist/**',
      'public/**',
      'out/**',
      'node_modules/**',
      'vite.config.ts',
      'map-editor/dist/**',
      'map-tile/dist/**',
      'rm-common/dist/**'
    ]
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './**/tsconfig.json'
      }
    },
    rules: {
      // The following two are for debug use. Should fix before release.
      '@typescript-eslint/no-unused-vars': 'warn',
      'prefer-const': 'warn',
      // NDNts style class & namespace combination requires turning off the following
      '@typescript-eslint/no-namespace': 'off',
      // Some cannot be fixed due to dependency issue
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
          singleQuote: true,
          useTabs: false,
          tabWidth: 2,
          printWidth: 120,
          semi: true
        }
      ]
    }
  }
];
