const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      // Allow intentionally-unused args prefixed with _ (Express handlers etc.).
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Empty catch blocks are used deliberately (best-effort operations).
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-console': 'off',
    },
  },
  {
    // Test files + the Vitest config are ES modules and add Vitest globals.
    files: ['tests/**/*.js', 'vitest.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...globals.vitest },
    },
  },
];
