/**
 * Controlador de entrenamiento (BE-03).
 */

const { sendSuccess, sendError } = require('../utils/response.util');
const prisma = require('../prisma/client');
const logger = require('../utils/logger.util');

/** Formatea una sesión de BD al formato que espera el frontend */
function formatSession(session) {
  return {
    id:               session.id,
    name:             session.notes ? session.notes.split('.')[0] : 'Entrenamiento del día',
    scheduled_date:   session.scheduled_date,
    status:           session.status,
    completed:        session.status === 'completed',
    duration_minutes: session.duration_minutes ?? 45,
    calories_burned:  session.calories_burned,
    muscle_groups:    [...new Set((session.session_exercises ?? []).map(se => se.exercise?.muscle_group).filter(Boolean))],
    exercises: (session.session_exercises ?? []).map(se => ({
      id:           se.id,
      exercise_id:  se.exercise_id,
      name:         se.exercise?.name ?? 'Ejercicio',
      muscle_group: se.exercise?.muscle_group ?? '',
      sets:         se.sets ?? 3,
      reps:         se.reps ?? 12,
      weight_kg:    se.weight_kg ? parseFloat(se.weight_kg) : null,
      rest_seconds: se.rest_seconds ?? 60,
      instructions: se.exercise?.instructions ?? '',
      completed:    se.completed ?? false,
    })),
  };
}

/** GET /training/today — Sesión programada para hoy */
const getTodaySession = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const today  = new Date();
    const sessions = await prisma.trainingSession.findMany({
      where: {
        user_id: userId,
        scheduled_date: { gte: new Date(today.setHours(0,0,0,0)), lte: new Date(today.setHours(23,59,59,999)) },
      },
      include: { session_exercises: { include: { exercise: true }, orderBy: { order_index: 'asc' } } },
      orderBy: { scheduled_date: 'asc' },
    });
    const session = sessions.find(s => s.status !== 'completed') ?? sessions[0] ?? null;
    return sendSuccess(res, session ? formatSession(session) : null, session ? 'Sesión de hoy' : 'Día de descanso');
  } catch (err) { next(err); }
};

/** GET /training/sessions — Sesiones del usuario */
const getSessions = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { date, status } = req.query;

    const where = { user_id: userId };
    if (status) where.status = status;

    if (date) {
      const d = new Date(date);
      where.scheduled_date = {
        gte: new Date(d.setHours(0, 0, 0, 0)),
        lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }

    const sessions = await prisma.trainingSession.findMany({
      where,
      include: { session_exercises: { include: { exercise: true }, orderBy: { order_index: 'asc' } } },
      orderBy: { scheduled_date: 'asc' },
    });

    return sendSuccess(res, { sessions: sessions.map(formatSession), total: sessions.length }, 'Sesiones de entrenamiento');
  } catch (err) { next(err); }
};

/** GET /training/sessions/:id */
const getSessionById = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const session = await prisma.trainingSession.findFirst({
      where: { id, user_id: userId },
      include: {
        session_exercises: { include: { exercise: true }, orderBy: { order_index: 'asc' } },
        plan: { select: { id: true, status: true } },
      },
    });

    if (!session) return sendError(res, 'NOT_FOUND', 'Sesión no encontrada', 404);
    return sendSuccess(res, { session }, 'Detalle de sesión');
  } catch (err) { next(err); }
};

/** PUT /training/sessions/:id/complete */
const completeSession = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { duration_minutes, calories_burned, notes } = req.body;

    const session = await prisma.trainingSession.findFirst({ where: { id, user_id: userId } });
    if (!session) return sendError(res, 'NOT_FOUND', 'Sesión no encontrada', 404);
    if (session.status === 'completed') return sendError(res, 'SESSION_ALREADY_COMPLETED', 'Esta sesión ya fue completada', 400);

    const updated = await prisma.trainingSession.update({
      where: { id },
      data: { status: 'completed', completed_at: new Date(), duration_minutes: duration_minutes || null, calories_burned: calories_burned || null, notes: notes || null },
    });

    return sendSuccess(res, { session: updated }, 'Sesión completada correctamente');
  } catch (err) { next(err); }
};

/** POST /training/sessions/:id/exercises/:exerciseId/complete — Registrar serie */
const completeExercise = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id: sessionId, exerciseId } = req.params;
    const { weight_kg, reps } = req.body;

    const session = await prisma.trainingSession.findFirst({ where: { id: sessionId, user_id: userId } });
    if (!session) return sendError(res, 'NOT_FOUND', 'Sesión no encontrada', 404);

    const sessionExercise = await prisma.sessionExercise.findFirst({
      where: { session_id: sessionId, exercise_id: exerciseId },
    });
    if (!sessionExercise) return sendError(res, 'NOT_FOUND', 'Ejercicio no encontrado en esta sesión', 404);

    const updated = await prisma.sessionExercise.update({
      where: { id: sessionExercise.id },
      data: { weight_kg: weight_kg || null, reps: reps !== undefined ? reps : sessionExercise.reps, completed: true },
    });

    return sendSuccess(res, { session_exercise: updated }, 'Serie registrada correctamente');
  } catch (err) { next(err); }
};

module.exports = { getTodaySession, getSessions, getSessionById, completeSession, completeExercise };
