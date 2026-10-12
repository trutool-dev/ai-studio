'use strict';

/**
 * Tests de integración para user controller (RGPD, TS-07).
 * Cubre: DELETE /user/me (Art. 17 — derecho al olvido),
 *        GET /user/me/export (Art. 20 — portabilidad de datos)
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../../backend/src/services/email.service', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../backend/src/services/aiService', () => ({
  calculateMetabolism: jest.fn().mockReturnValue({ bmr: 1749, tdee: 2711, target_calories: 2168 }),
  generatePlan: jest.fn().mockResolvedValue({}),
  regeneratePlan: jest.fn().mockResolvedValue({}),
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
  generateFallbackPlan: jest.fn().mockReturnValue({}),
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

const request = require('supertest');
const {
  app,
  prisma,
  createAndLoginUser,
  getAuthHeader,
  cleanupUser,
  cleanupAllTestUsers,
  teardown,
} = require('../helpers/testSetup');

const createdEmails = [];

afterAll(async () => {
  for (const email of createdEmails) {
    await cleanupUser(email);
  }
  await cleanupAllTestUsers();
  await teardown();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /user/me/export — Portabilidad de datos (RGPD Art. 20)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /user/me/export', () => {
  let token;

  beforeAll(async () => {
    const user = await createAndLoginUser();
    createdEmails.push(user.email);
    token = user.access_token;
  });

  test('devuelve estructura de exportación completa con status 200', async () => {
    const res = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('exportDate');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email');
    expect(res.body.user).toHaveProperty('created_at');
  });

  test('incluye todas las secciones RGPD esperadas', async () => {
    const res = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    expect(res.body).toHaveProperty('profile');
    expect(res.body).toHaveProperty('lifestyle');
    expect(res.body).toHaveProperty('training_preferences');
    expect(res.body).toHaveProperty('nutrition_preferences');
    expect(res.body).toHaveProperty('health_conditions');
    expect(res.body).toHaveProperty('food_restrictions');
    expect(res.body).toHaveProperty('motivation');
    expect(res.body).toHaveProperty('plans');
    expect(res.body).toHaveProperty('progress_logs');
    expect(res.body).toHaveProperty('daily_logs');
  });

  test('devuelve arrays vacíos para datos que no existen', async () => {
    const res = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    expect(Array.isArray(res.body.health_conditions)).toBe(true);
    expect(Array.isArray(res.body.food_restrictions)).toBe(true);
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(Array.isArray(res.body.progress_logs)).toBe(true);
    expect(Array.isArray(res.body.daily_logs)).toBe(true);
  });

  test('establece Content-Disposition como adjunto descargable', async () => {
    const res = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.headers['content-disposition']).toContain('healthy-data-export.json');
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).get('/user/me/export');
    expect(res.status).toBe(401);
  });

  test('no expone datos de otro usuario', async () => {
    const otherUser = await createAndLoginUser();
    createdEmails.push(otherUser.email);

    const resOther = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(otherUser.access_token));

    const resOriginal = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    // Cada usuario solo ve su propio email
    expect(resOther.body.user.email).not.toBe(resOriginal.body.user.email);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /user/me — Derecho al olvido (RGPD Art. 17)
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /user/me', () => {
  test('elimina la cuenta del usuario y devuelve 200', async () => {
    const user = await createAndLoginUser();
    // No añadimos a createdEmails porque vamos a borrar el usuario nosotros
    const token = user.access_token;

    const res = await request(app)
      .delete('/user/me')
      .set('Authorization', getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('el token queda inválido después de borrar la cuenta', async () => {
    const user = await createAndLoginUser();
    const token = user.access_token;

    // Borrar cuenta
    await request(app)
      .delete('/user/me')
      .set('Authorization', getAuthHeader(token));

    // Intentar acceder con el token del usuario borrado
    const res = await request(app)
      .get('/user/me/export')
      .set('Authorization', getAuthHeader(token));

    // El usuario ya no existe → 401 o 404
    expect([401, 404]).toContain(res.status);
  });

  test('requiere autenticación → 401', async () => {
    const res = await request(app).delete('/user/me');
    expect(res.status).toBe(401);
  });

  test('borra todos los datos del usuario de la base de datos', async () => {
    const user = await createAndLoginUser();
    const token = user.access_token;
    const userId = user.user.id;

    // Asegurar que el usuario existe antes del borrado
    const beforeDelete = await prisma.user.findUnique({ where: { id: userId } });
    expect(beforeDelete).not.toBeNull();

    await request(app)
      .delete('/user/me')
      .set('Authorization', getAuthHeader(token));

    // Verificar que ya no existe en BD
    const afterDelete = await prisma.user.findUnique({ where: { id: userId } });
    expect(afterDelete).toBeNull();
  });
});
