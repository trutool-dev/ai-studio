'use strict';

/**
 * Tests adicionales de branches para response.util.js
 * Cubre las ramas de parámetros por defecto (default arguments).
 * response.util.js tiene 7.69% branch coverage — los defaults no están cubiertos.
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

function makeMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// ─── sendSuccess — ramas de defaults ─────────────────────────────────────────

describe('sendSuccess — default parameters', () => {
  test('llama con solo res (todos los defaults activos)', () => {
    const res = makeMockRes();
    sendSuccess(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: {}, message: 'OK' })
    );
  });

  test('llama con res y data sin message ni statusCode', () => {
    const res = makeMockRes();
    sendSuccess(res, { id: 42 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: 42 }, message: 'OK' })
    );
  });

  test('llama con res, data y message sin statusCode', () => {
    const res = makeMockRes();
    sendSuccess(res, { id: 1 }, 'Custom message');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Custom message' })
    );
  });

  test('usa statusCode personalizado', () => {
    const res = makeMockRes();
    sendSuccess(res, {}, 'Created', 201);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

// ─── sendError — ramas de defaults ───────────────────────────────────────────

describe('sendError — default parameters', () => {
  test('llama con solo res (todos los defaults activos)', () => {
    const res = makeMockRes();
    sendError(res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'BAD_REQUEST', message: 'Ha ocurrido un error' })
    );
  });

  test('llama con res y error sin message ni statusCode', () => {
    const res = makeMockRes();
    sendError(res, 'CUSTOM_ERROR');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'CUSTOM_ERROR', message: 'Ha ocurrido un error' })
    );
  });

  test('llama con res, error y message sin statusCode', () => {
    const res = makeMockRes();
    sendError(res, 'MY_ERROR', 'My message');
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── sendCreated — ramas de defaults ─────────────────────────────────────────

describe('sendCreated — default parameters', () => {
  test('llama con solo res (defaults activos)', () => {
    const res = makeMockRes();
    sendCreated(res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: {}, message: 'Recurso creado correctamente' })
    );
  });

  test('llama con res y data sin message', () => {
    const res = makeMockRes();
    sendCreated(res, { id: 'abc' });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: 'abc' }, message: 'Recurso creado correctamente' })
    );
  });
});

// ─── sendNotFound — default message ──────────────────────────────────────────

describe('sendNotFound — default parameters', () => {
  test('llama con solo res (default message activo)', () => {
    const res = makeMockRes();
    sendNotFound(res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'NOT_FOUND', message: 'Recurso no encontrado' })
    );
  });
});

// ─── sendUnauthorized — default message ──────────────────────────────────────

describe('sendUnauthorized — default parameters', () => {
  test('llama con solo res (default message activo)', () => {
    const res = makeMockRes();
    sendUnauthorized(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'UNAUTHORIZED', message: 'No autorizado' })
    );
  });
});

// ─── sendForbidden — default message ─────────────────────────────────────────

describe('sendForbidden — default parameters', () => {
  test('llama con solo res (default message activo)', () => {
    const res = makeMockRes();
    sendForbidden(res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FORBIDDEN', message: 'Acceso denegado' })
    );
  });
});

// ─── sendValidationError — default message ────────────────────────────────────

describe('sendValidationError — default parameters', () => {
  test('llama con res y errors sin message', () => {
    const res = makeMockRes();
    sendValidationError(res, []);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'VALIDATION_ERROR', message: 'Error de validación' })
    );
  });
});

// ─── sendServerError — default message ───────────────────────────────────────

describe('sendServerError — default parameters', () => {
  test('llama con solo res (default message activo)', () => {
    const res = makeMockRes();
    sendServerError(res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'INTERNAL_ERROR', message: 'Error interno del servidor' })
    );
  });
});
