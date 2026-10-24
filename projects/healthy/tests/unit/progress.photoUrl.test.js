'use strict';

/**
 * SEC-64 (SA-29): photo_url solo https y con host en PHOTO_URL_ALLOWED_HOSTS
 * (por defecto, ninguno permitido).
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-tests-only';

jest.mock('../../backend/src/services/aiService', () => ({
  shouldRegeneratePlan: jest.fn().mockReturnValue(false),
}));
jest.mock('../../backend/src/services/redis.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  on: jest.fn(),
}));
const mockPrisma = {
  progressLog: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};
jest.mock('../../backend/src/prisma/client', () => mockPrisma);

const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('../../backend/node_modules/express');
const progressRoutes = require('../../backend/src/routes/progress.routes');
const { isAllowedPhotoUrl } = progressRoutes;

const app = express();
app.use(express.json());
app.use('/progress', progressRoutes);

const auth = () => `Bearer ${jwt.sign({ userId: 'u1', sessionId: 's' }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;

const saved = process.env.PHOTO_URL_ALLOWED_HOSTS;
afterAll(() => {
  if (saved === undefined) delete process.env.PHOTO_URL_ALLOWED_HOSTS; else process.env.PHOTO_URL_ALLOWED_HOSTS = saved;
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.progressLog.findFirst.mockResolvedValue(null);
  mockPrisma.progressLog.create.mockImplementation(async ({ data }) => ({ id: 'p1', ...data }));
  mockPrisma.progressLog.findMany.mockResolvedValue([]);
});

describe('isAllowedPhotoUrl', () => {
  test('sin allowlist configurada rechaza cualquier URL (defecto conservador)', () => {
    delete process.env.PHOTO_URL_ALLOWED_HOSTS;
    expect(isAllowedPhotoUrl('https://cdn.example.com/a.jpg')).toBe(false);
  });

  describe('con PHOTO_URL_ALLOWED_HOSTS=cdn.example.com, photos.test', () => {
    beforeEach(() => { process.env.PHOTO_URL_ALLOWED_HOSTS = 'cdn.example.com, Photos.test'; });

    test.each([
      ['https://cdn.example.com/a.jpg', true],
      ['https://img.cdn.example.com/a.jpg', true],
      ['https://photos.test/x.png', true],
      ['http://cdn.example.com/a.jpg', false],
      ['https://evil.com/a.jpg', false],
      ['https://cdn.example.com.evil.com/a.jpg', false],
      ['https://evilcdn.example.com/a.jpg', false],
      ['https://user:pass@cdn.example.com/a.jpg', false],
      ['javascript:alert(1)', false],
      ['data:image/png;base64,AAAA', false],
      ['no es una url', false],
      [`https://cdn.example.com/${'a'.repeat(2050)}`, false],
      [123, false],
    ])('%p → %p', (url, expected) => {
      expect(isAllowedPhotoUrl(url)).toBe(expected);
    });
  });
});

describe('POST /progress con photo_url', () => {
  test('URL http → 400', async () => {
    process.env.PHOTO_URL_ALLOWED_HOSTS = 'cdn.example.com';
    const res = await request(app).post('/progress').set('Authorization', auth())
      .send({ log_date: '2026-10-19', photo_url: 'http://cdn.example.com/a.jpg' });
    expect(res.status).toBe(400);
    expect(mockPrisma.progressLog.create).not.toHaveBeenCalled();
  });

  test('host no permitido → 400', async () => {
    process.env.PHOTO_URL_ALLOWED_HOSTS = 'cdn.example.com';
    const res = await request(app).post('/progress').set('Authorization', auth())
      .send({ log_date: '2026-10-19', photo_url: 'https://tracker.evil/pixel.gif' });
    expect(res.status).toBe(400);
  });

  test('URL https de host permitido → 201', async () => {
    process.env.PHOTO_URL_ALLOWED_HOSTS = 'cdn.example.com';
    const res = await request(app).post('/progress').set('Authorization', auth())
      .send({ log_date: '2026-10-19', photo_url: 'https://cdn.example.com/a.jpg' });
    expect(res.status).toBe(201);
    expect(mockPrisma.progressLog.create.mock.calls[0][0].data.photo_url).toBe('https://cdn.example.com/a.jpg');
  });

  test('sin photo_url o null → 201', async () => {
    delete process.env.PHOTO_URL_ALLOWED_HOSTS;
    const r1 = await request(app).post('/progress').set('Authorization', auth()).send({ log_date: '2026-10-19' });
    expect(r1.status).toBe(201);
    const r2 = await request(app).post('/progress').set('Authorization', auth()).send({ log_date: '2026-10-20', photo_url: null });
    expect(r2.status).toBe(201);
  });
});
