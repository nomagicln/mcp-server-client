module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es2022: true
  },
  globals: {
    NodeJS: 'readonly'
  },
  ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/', 'coverage/', 'tsup.config.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-debugger': 'error'
  }
};