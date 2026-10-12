/**
 * Mock del cliente Redis (ioredis) para tests.
 * Implementa las operaciones usadas en el backend con un almacén en memoria simple.
 */

'use strict';

const store = new Map();

const redisMock = {
  get: jest.fn(async (key) => store.get(key) ?? null),

  set: jest.fn(async (key, value, ...args) => {
    store.set(key, value);
    // Soporta EX <segundos> para TTL (ignoramos TTL en el mock)
    return 'OK';
  }),

  setEx: jest.fn(async (key, seconds, value) => {
    store.set(key, value);
    return 'OK';
  }),

  del: jest.fn(async (...keys) => {
    let count = 0;
    for (const key of keys) { if (store.delete(key)) count++; }
    return count;
  }),

  ping: jest.fn(async () => 'PONG'),

  exists: jest.fn(async (...keys) => {
    return keys.filter((k) => store.has(k)).length;
  }),

  expire: jest.fn(async () => 1),

  hGet: jest.fn(async () => null),
  hSet: jest.fn(async () => 1),
  hGetAll: jest.fn(async () => ({})),

  keys: jest.fn(async (pattern) => {
    if (!pattern || pattern === '*') return [...store.keys()];
    // Soporte básico de patrón glob con *
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...store.keys()].filter((k) => regex.test(k));
  }),

  flushDb: jest.fn(async () => { store.clear(); return 'OK'; }),

  quit: jest.fn(async () => 'OK'),

  disconnect: jest.fn(),

  on: jest.fn(),

  // Expone el store para inspección en tests si hace falta
  _store: store,

  // Helper para limpiar entre tests
  _reset() { store.clear(); },
};

module.exports = redisMock;
