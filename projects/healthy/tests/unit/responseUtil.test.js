'use strict';

/**
 * Tests unitarios para response.util.js y errorHandler.middleware.js
 */

const {
  sendSuccess,
  sendError,
  sendCreated,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
  sendValidationError,
  sendServerError,
} = require('../../backend/src/utils/response.util');

const errorHandler = require('../../backend/src/middleware/errorHandler.middleware');

// ─── Mock de res ──────────────────────────────────────────────────────────────

function makeMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── sendSuccess ──────────────────────────────────────────────────────────────

describe('sendSuccess', () => {
  test('devuelve 200 con success:true y datos', () => {
    const res = makeMockRes();
    sendSuccess(res, { id: 1 }, 'OK', 200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: 1 }, message: 'OK' }));
  });
});

// ─── sendError ────────────────────────────────────────────────────────────────

describe('sendError', () => {
  test('devuelve 400 con success:false y código de error', () => {
    const res = makeMockRes();
    sendError(res, 'MY_ERROR', 'Error de prueba', 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: 'MY_ERROR', message: 'Error de prueba' }));
  });
});

// ─── sendCreated ──────────────────────────────────────────────────────────────

describe('sendCreated', () => {
  test('devuelve 201 con datos del recurso creado', () => {
    const res = makeMockRes();
    sendCreated(res, { id: 'new-id' }, 'Creado');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { id: 'new-id' } }));
  });
});

// ─── sendNotFound ─────────────────────────────────────────────────────────────

describe('sendNotFound', () => {
  test('devuelve 404', () => {
    const res = makeMockRes();
    sendNotFound(res, 'No encontrado');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'NOT_FOUND' }));
  });
});

// ─── sendUnauthorized ─────────────────────────────────────────────────────────

describe('sendUnauthorized', () => {
  test('devuelve 401', () => {
    const res = makeMockRes();
    sendUnauthorized(res, 'No autorizado');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'UNAUTHORIZED' }));
  });
});

// ─── sendForbidden ────────────────────────────────────────────────────────────

describe('sendForbidden', () => {
  test('devuelve 403', () => {
    const res = makeMockRes();
    sendForbidden(res, 'Prohibido');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FORBIDDEN' }));
  });
});

// ─── sendValidationError ──────────────────────────────────────────────────────

describe('sendValidationError', () => {
  test('devuelve 422 con lista de errores', () => {
    const res = makeMockRes();
    sendValidationError(res, [{ field: 'email', message: 'Email inválido' }], 'Validación fallida');
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'Email inválido' }],
    }));
  });
});

// ─── sendServerError ──────────────────────────────────────────────────────────

describe('sendServerError', () => {
  test('devuelve 500', () => {
    const res = makeMockRes();
    sendServerError(res, 'Error interno');
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INTERNAL_ERROR' }));
  });
});

// ─── errorHandler ─────────────────────────────────────────────────────────────

describe('errorHandler middleware', () => {
  function makeReq(path = '/test', method = 'GET') {
    return { path, method };
  }

  test('devuelve 404 para errores Prisma P2025 (not found)', () => {
    const res = makeMockRes();
    const err = new Error('Record not found');
    err.code = 'P2025';
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('devuelve 409 para errores Prisma P2002 (unique constraint)', () => {
    const res = makeMockRes();
    const err = new Error('Unique constraint failed');
    err.code = 'P2002';
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('devuelve 500 para errores genéricos', () => {
    const res = makeMockRes();
    const err = new Error('Unexpected error');
    errorHandler(err, makeReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'INTERNAL_ERROR' }));
  });
});
