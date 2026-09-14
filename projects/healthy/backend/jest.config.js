/**
 * Configuración de Jest para el backend de Healthy.
 */

const path = require('path');

module.exports = {
  testEnvironment: 'node',

  roots: [
    '<rootDir>',
    '<rootDir>/../tests',
  ],

  testMatch: [
    '<rootDir>/../tests/**/*.test.js',
    '<rootDir>/../tests/*.test.js',
  ],

  // ─── Mocks automáticos de Prisma y Redis ────────────────────────────────────
  // Redirige cualquier import de prisma/client o redis.service al mock en memoria,
  // independientemente de la profundidad relativa desde la que se importe.
  moduleNameMapper: {
    // Rutas absolutas resueltas (para imports desde src/ y desde tests/)
    [path.resolve(__dirname, 'src/prisma/client').replace(/\\/g, '\\\\')]:
      '<rootDir>/src/__mocks__/prisma.js',
    [path.resolve(__dirname, 'src/services/redis.service').replace(/\\/g, '\\\\')]:
      '<rootDir>/src/__mocks__/redis.service.js',

    // Patrones de ruta relativa para todos los archivos dentro de src/
    '^(?:\\.{1,2}/)+prisma/client$': '<rootDir>/src/__mocks__/prisma.js',
    '^(?:\\.{1,2}/)+services/redis\\.service$': '<rootDir>/src/__mocks__/redis.service.js',

    // Desde tests/helpers/testSetup.js (ruta ../../backend/src/...)
    '^(?:\\.{1,2}/)+backend/src/prisma/client$': '<rootDir>/src/__mocks__/prisma.js',
    '^(?:\\.{1,2}/)+backend/src/services/redis\\.service$': '<rootDir>/src/__mocks__/redis.service.js',
  },

  collectCoverageFrom: [
    '<rootDir>/src/**/*.js',
    '!<rootDir>/src/generated/**',
    // Servicios externos: requieren credenciales reales (Anthropic, SMTP, Supabase, Redis)
    // Se excluyen de la cobertura por ser integraciones de terceros no testables en CI local
    '!<rootDir>/src/services/aiService.js',
    '!<rootDir>/src/services/authService.js',
    '!<rootDir>/src/services/cacheService.js',
    '!<rootDir>/src/services/email.service.js',
// El cliente Prisma es un wrapper de tercero, siempre sustituido por el mock en tests
    '!<rootDir>/src/prisma/client.js',
    // El rate limiter en modo test es un no-op; el código de producción no se ejecuta en tests
    '!<rootDir>/src/middleware/rateLimiter.middleware.js',
    // El mock de Prisma/Redis no es código de producción
    '!<rootDir>/src/__mocks__/**',
  ],

  coverageThreshold: {
    global: {
      lines: 80,
      branches: 80,
    },
  },

  coverageReporters: ['text', 'lcov', 'html'],

  testEnvironmentOptions: {},

  // Permite que tests en tests/unit/ y tests/integration/ resuelvan módulos
  // instalados en backend/node_modules (pg, @anthropic-ai/sdk, @prisma/adapter-pg)
  modulePaths: [
    '<rootDir>/node_modules',
  ],

  testTimeout: 30000,
};
