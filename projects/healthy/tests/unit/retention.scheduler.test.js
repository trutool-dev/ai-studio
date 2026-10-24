'use strict';

/**
 * SEC-50: programador diario en proceso del job de retención.
 * Temporizadores falsos de Jest y función de purga simulada: nunca toca una BD real.
 */

const {
  startRetentionScheduler, getSchedulerConfig, msUntilNextRun, DEFAULT_HOUR_UTC,
} = require('../../backend/src/jobs/scheduler');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const makeLogger = () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() });
const fakePrisma = {};

describe('getSchedulerConfig', () => {
  it('está desactivado por defecto y usa la hora por defecto', () => {
    expect(getSchedulerConfig({})).toEqual({ enabled: false, hourUtc: DEFAULT_HOUR_UTC });
  });

  it('solo se activa con "true" (sin distinguir mayúsculas ni espacios)', () => {
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_ENABLED: ' TRUE ' }).enabled).toBe(true);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_ENABLED: '1' }).enabled).toBe(false);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_ENABLED: 'false' }).enabled).toBe(false);
  });

  it('acepta horas 0-23 y descarta valores inválidos', () => {
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_HOUR_UTC: '0' }).hourUtc).toBe(0);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_HOUR_UTC: '23' }).hourUtc).toBe(23);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_HOUR_UTC: '24' }).hourUtc).toBe(DEFAULT_HOUR_UTC);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_HOUR_UTC: '-1' }).hourUtc).toBe(DEFAULT_HOUR_UTC);
    expect(getSchedulerConfig({ RETENTION_SCHEDULER_HOUR_UTC: 'abc' }).hourUtc).toBe(DEFAULT_HOUR_UTC);
  });
});

describe('msUntilNextRun', () => {
  it('programa hoy si la hora aún no ha llegado', () => {
    expect(msUntilNextRun(new Date('2026-10-21T01:00:00Z'), 3)).toBe(2 * HOUR);
  });

  it('programa mañana si la hora ya pasó o es exactamente ahora', () => {
    expect(msUntilNextRun(new Date('2026-10-21T05:00:00Z'), 3)).toBe(22 * HOUR);
    expect(msUntilNextRun(new Date('2026-10-21T03:00:00Z'), 3)).toBe(DAY);
  });
});

describe('startRetentionScheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('desactivado: no programa nada ni ejecuta la purga', async () => {
    const run = jest.fn();
    const logger = makeLogger();
    const s = startRetentionScheduler({ prisma: fakePrisma, logger, env: {}, run });
    expect(s.enabled).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
    await expect(s.runNow()).resolves.toBeNull();
    s.stop();
    expect(run).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('desactivado'));
  });

  it('activado sin prisma lanza un error de configuración', () => {
    expect(() => startRetentionScheduler({ env: { RETENTION_SCHEDULER_ENABLED: 'true' } }))
      .toThrow('prisma es obligatorio');
  });

  it('ejecuta a la hora indicada y después cada 24 h con la config de entorno', async () => {
    const run = jest.fn().mockResolvedValue({ sessions: 1 });
    const now = () => new Date('2026-10-21T01:00:00Z');
    const env = { RETENTION_SCHEDULER_ENABLED: 'true', RETENTION_SCHEDULER_HOUR_UTC: '3', RETENTION_OTP_DAYS: '7' };
    const s = startRetentionScheduler({ prisma: fakePrisma, logger: makeLogger(), env, now, run });

    expect(s.enabled).toBe(true);
    expect(s.nextRunInMs).toBe(2 * HOUR);

    await jest.advanceTimersByTimeAsync(2 * HOUR - 1);
    expect(run).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0][0]).toEqual(expect.objectContaining({
      prisma: fakePrisma,
      config: expect.objectContaining({ otpDays: 7, sessionDays: 30 }),
    }));

    await jest.advanceTimersByTimeAsync(DAY);
    expect(run).toHaveBeenCalledTimes(2);

    s.stop();
    await jest.advanceTimersByTimeAsync(3 * DAY);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('un fallo de la purga se registra y no se propaga', async () => {
    const logger = makeLogger();
    const run = jest.fn().mockRejectedValue(Object.assign(new Error('db down'), { code: 'P1001' }));
    const s = startRetentionScheduler({ prisma: fakePrisma, logger, env: { RETENTION_SCHEDULER_ENABLED: 'true' }, run });
    await expect(s.runNow()).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('P1001'));
    s.stop();
  });

  it('no solapa ejecuciones si la anterior sigue en curso', async () => {
    const logger = makeLogger();
    let release;
    const run = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const s = startRetentionScheduler({ prisma: fakePrisma, logger, env: { RETENTION_SCHEDULER_ENABLED: 'true' }, run });

    const first = s.runNow();
    await expect(s.runNow()).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('en curso'));
    release({ sessions: 0 });
    await expect(first).resolves.toEqual({ sessions: 0 });
    expect(run).toHaveBeenCalledTimes(1);
    s.stop();
  });

  it('los temporizadores no mantienen vivo el proceso (unref)', () => {
    jest.useRealTimers();
    const spy = jest.spyOn(global, 'setTimeout');
    const s = startRetentionScheduler({
      prisma: fakePrisma, logger: makeLogger(), env: { RETENTION_SCHEDULER_ENABLED: 'true' }, run: jest.fn(),
    });
    const timer = spy.mock.results[spy.mock.results.length - 1].value;
    expect(timer.hasRef()).toBe(false);
    s.stop();
    spy.mockRestore();
  });
});
