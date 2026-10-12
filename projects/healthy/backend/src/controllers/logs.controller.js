/**
 * Controlador de logs diarios (BE-06).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');

async function getOrCreateTodayLog(userId, todayStart) {
  let log = await prisma.dailyLog.findFirst({
    where: { user_id: userId, log_date: { gte: todayStart, lte: new Date(todayStart.getTime() + 86399999) } },
  });
  if (!log) {
    log = await prisma.dailyLog.create({ data: { user_id: userId, log_date: todayStart } });
  }
  return log;
}

/** GET /logs/today — Obtiene o crea el log del día */
const getToday = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const log = await getOrCreateTodayLog(userId, today);
    return sendSuccess(res, { log }, 'Log del día');
  } catch (err) { next(err); }
};

/** PUT /logs/today — Actualizar agua, sueño, energía, pasos, ánimo */
const updateToday = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { water_ml, sleep_hours, sleep_quality, energy_level, mood, steps } = req.body;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await getOrCreateTodayLog(userId, today);

    const updated = await prisma.dailyLog.update({
      where: { user_id_log_date: { user_id: userId, log_date: today } },
      data: {
        ...(water_ml !== undefined && { water_ml }),
        ...(sleep_hours !== undefined && { sleep_hours }),
        ...(sleep_quality !== undefined && { sleep_quality }),
        ...(energy_level !== undefined && { energy_level }),
        ...(mood !== undefined && { mood }),
        ...(steps !== undefined && { steps }),
      },
    });

    return sendSuccess(res, { log: updated }, 'Log del día actualizado');
  } catch (err) { next(err); }
};

/** GET /logs/history?days=30 — Historial de logs */
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const days = Math.min(parseInt(req.query.days || '30', 10), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const logs = await prisma.dailyLog.findMany({
      where: { user_id: userId, log_date: { gte: since } },
      orderBy: { log_date: 'desc' },
    });

    const withData = logs.filter(l => l.water_ml || l.sleep_hours || l.energy_level || l.steps);
    const averages = withData.length > 0 ? {
      avg_water_ml: Math.round(withData.reduce((s, l) => s + (l.water_ml || 0), 0) / withData.length),
      avg_sleep_hours: parseFloat((withData.reduce((s, l) => s + parseFloat(l.sleep_hours || 0), 0) / withData.length).toFixed(1)),
      avg_energy_level: parseFloat((withData.reduce((s, l) => s + (l.energy_level || 0), 0) / withData.length).toFixed(1)),
      avg_mood: parseFloat((withData.reduce((s, l) => s + (l.mood || 0), 0) / withData.length).toFixed(1)),
      avg_steps: Math.round(withData.reduce((s, l) => s + (l.steps || 0), 0) / withData.length),
    } : null;

    return sendSuccess(res, { logs, total: logs.length, days_requested: days, averages }, `Historial de los últimos ${days} días`);
  } catch (err) { next(err); }
};

module.exports = { getToday, updateToday, getHistory };
