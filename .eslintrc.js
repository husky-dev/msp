module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  root: true,
  rules: {
    'max-len': ['warn', { code: 130, tabWidth: 2, ignoreStrings: true }],
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-duplicate-enum-values': 'warn',
  }
};
