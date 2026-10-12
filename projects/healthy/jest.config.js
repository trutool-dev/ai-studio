/**
 * Configuración de Jest para el proyecto Healthy (raíz).
 * Los tests unitarios (src/utils) corren sin BD ni Prisma.
 * Los tests de integración/E2E requieren BD real y se ejecutan
 * desde backend/ con la config de backend/jest.config.js.
 */

module.exports = {
  testEnvironment: 'node',

  // Por defecto: solo tests unitarios (no requieren BD)
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.js',
    '<rootDir>/tests/nutritionCalculator.test.js',
  ],

  // Cobertura solo del módulo de utilidades del AI (sin servicios externos)
  collectCoverageFrom: [
    '<rootDir>/src/utils/**/*.js',
  ],

  coverageThreshold: {
    global: {
      lines: 80,
    },
  },

  coverageReporters: ['text', 'lcov', 'html'],

  testTimeout: 10000,
};
