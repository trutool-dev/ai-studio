/**
 * Configuración de ESLint (flat config, ESLint 9) para el backend de Healthy (A-28).
 * Código Node.js en CommonJS. Los tests viven en ../tests y se lintan desde la suite raíz;
 * aquí solo se aplica el entorno de Jest a los mocks de src/__mocks__.
 */

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    // Cliente Prisma generado, cobertura y dependencias: no es código propio
    ignores: ['node_modules/**', 'coverage/**', 'src/generated/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Variables sin usar: se permiten los argumentos y capturas con prefijo `_`
      'no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',
      'no-return-await': 'off',
      // El logger (winston) es el canal de logs; console solo en scripts de prisma/
      'no-console': 'warn',
    },
  },
  {
    // Scripts de importación y seeds: herramientas de línea de comandos
    files: ['prisma/**/*.js', 'server.js'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/__mocks__/**/*.js'],
    languageOptions: { globals: { ...globals.jest } },
  },
];
