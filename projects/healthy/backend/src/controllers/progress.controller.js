/**
 * Controlador de progreso (BE-05).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');
const aiService = require('../services/aiService');

/** GET /progress — Historial ordenado desc */
const getProgress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    const [logs, total] = await Promise.all([
      prisma.progressLog.findMany({ where: { user_id: userId }, orderBy: { log_date: 'desc' }, take: limit, skip: offset }),
      prisma.progressLog.count({ where: { user_id: userId } }),
    ]);

    return sendSuccess(res, { logs, total, limit, offset }, 'Historial de progreso');
  } catch (err) { next(err); }
};

/** POST /progress — Nuevo registro */
const createProgress = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { log_date, weight_kg, body_fat_percentage, muscle_mass_kg, waist_cm, hip_cm, chest_cm, notes, photo_url } = req.body;

    const startOfDay = new Date(new Date(log_date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(log_date).setHours(23, 59, 59, 999));

    const existing = await prisma.progressLog.findFirst({ where: { user_id: userId, log_date: { gte: startOfDay, lte: endOfDay } } });
    if (existing) return sendError(res, 'PROGRESS_ALREADY_EXISTS', 'Ya existe un registro de progreso para esa fecha', 409);

    const log = await prisma.progressLog.create({
      data: {
        user_id: userId,
        log_date: new Date(log_date),
        weight_kg: weight_kg || null,
        body_fat_percentage: body_fat_percentage || null,
        muscle_mass_kg: muscle_mass_kg || null,
        waist_cm: waist_cm || null,
        hip_cm: hip_cm || null,
        chest_cm: chest_cm || null,
        notes: notes || null,
        photo_url: photo_url || null,
      },
    });

    // Verificar estancamiento (AI-04)
    const recentLogs = await prisma.progressLog.findMany({ where: { user_id: userId }, orderBy: { log_date: 'desc' }, take: 30 });
    const needsRegeneration = aiService.shouldRegeneratePlan(
      recentLogs.map(l => ({ log_date: l.log_date.toISOString(), weight_kg: l.weight_kg ? parseFloat(l.weight_kg) : null }))
    );

    return sendSuccess(res, { log, needs_plan_regeneration: needsRegeneration }, 'Registro de progreso creado', 201);
  } catch (err) { next(err); }
};

/** GET /progress/stats — Estadísticas de progreso */
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const logs = await prisma.progressLog.findMany({ where: { user_id: userId }, orderBy: { log_date: 'desc' } });

    if (logs.length === 0) return sendSuccess(res, { last_weight: null, total_change: null, streak: 0, total_logs: 0 }, 'Sin registros aún');

    const withWeight = logs.filter(l => l.weight_kg !== null);
    const lastWeight = withWeight.length > 0 ? parseFloat(withWeight[0].weight_kg) : null;
    const firstWeight = withWeight.length > 0 ? parseFloat(withWeight[withWeight.length - 1].weight_kg) : null;
    const totalChange = lastWeight !== null && firstWeight !== null ? parseFloat((lastWeight - firstWeight).toFixed(2)) : null;

    // Racha actual (días consecutivos)
    let streak = 0;
    const todayBase = new Date();
    todayBase.setHours(0, 0, 0, 0);
    for (let i = 0; i < logs.length; i++) {
      const logDate = new Date(logs[i].log_date);
      logDate.setHours(0, 0, 0, 0);
      const expected = new Date(todayBase);
      expected.setDate(todayBase.getDate() - i);
      if (logDate.getTime() === expected.getTime()) streak++;
      else break;
    }

    return sendSuccess(res, {
      last_weight: lastWeight,
      first_weight: firstWeight,
      total_change: totalChange,
      total_change_direction: totalChange !== null ? (totalChange < 0 ? 'down' : totalChange > 0 ? 'up' : 'stable') : null,
      streak,
      total_logs: logs.length,
      last_log_date: logs[0].log_date,
    }, 'Estadísticas de progreso');
  } catch (err) { next(err); }
};

module.exports = { getProgress, createProgress, getStats };
