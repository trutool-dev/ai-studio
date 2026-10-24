/**
 * Persistencia de un plan generado (onboarding/complete y plans/regenerate).
 *
 * SEC-36 (JB-04): todas las escrituras van en `prisma.$transaction`: si algo
 *   falla no quedan planes a medias ni el plan anterior desactivado.
 * SEC-54 (JB-10) + SEC-23: los IDs de ejercicio que devuelve el LLM se validan
 *   contra el catálogo enviado; las sesiones guardadas usan esos ejercicios
 *   (si un día no tiene ninguno válido, se rellena por rotación del catálogo).
 */

'use strict';

const EXERCISES_PER_SESSION = 4;
const TX_TIMEOUT_MS = 20000;

/** Clave pública del ejercicio en el catálogo (la que ve el LLM). */
const publicId = (ex) => String(ex.externalId ?? ex.id);

/**
 * Elimina del plan los ejercicios cuyo `id` no está en el catálogo enviado.
 * Los planes de respaldo (sin IA) se devuelven tal cual: sus ejercicios los
 * define el servidor.
 * @returns {{ plan: object, removed: number }}
 */
function filterPlanExercisesByCatalog(plan, catalog = []) {
  if (!plan || !plan.training_plan || !Array.isArray(plan.training_plan.weekly_schedule) || plan.generated_by_ai === false) {
    return { plan, removed: 0 };
  }
  const ids = new Set((catalog || []).map(publicId));
  let removed = 0;
  const weekly_schedule = plan.training_plan.weekly_schedule.map((day) => {
    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    const kept = exercises.filter((ex) => ex && ex.id !== undefined && ex.id !== null && ids.has(String(ex.id)));
    removed += exercises.length - kept.length;
    return { ...day, exercises: kept };
  });
  return { plan: { ...plan, training_plan: { ...plan.training_plan, weekly_schedule } }, removed };
}

/** ISO weekday (1=lunes..7=domingo) → fecha de la semana `week` a partir de startDate. */
function sessionDateFor(startDate, week, isoDay) {
  const targetJsDay = isoDay === 7 ? 0 : isoDay;
  let offset = targetJsDay - startDate.getDay();
  if (offset < 0) offset += 7;
  const d = new Date(startDate);
  d.setDate(startDate.getDate() + week * 7 + offset);
  return d;
}

const toIntOrNull = (v, min, max) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, min), max);
};

/**
 * Guarda el plan, sus sesiones (con ejercicios) y, opcionalmente, las comidas
 * de la primera semana, en una única transacción.
 *
 * @param {object} prisma - cliente Prisma
 * @param {object} opts
 * @param {string} opts.userId
 * @param {object} opts.plan - plan YA validado (esquema + catálogo)
 * @param {Array} [opts.catalog] - ejercicios del catálogo enviados al LLM
 * @param {'completed'|'paused'} opts.previousPlansStatus
 * @param {string|null} opts.promptLabel - valor para `ai_prompt_used` (allowlist)
 * @param {boolean} [opts.includeMeals]
 * @param {Date} [opts.startDate]
 * @returns {Promise<object>} plan creado
 */
async function persistGeneratedPlan(prisma, opts) {
  const { userId, plan, catalog = [], previousPlansStatus, promptLabel, includeMeals = false } = opts;
  const startDate = opts.startDate || new Date();
  // Defensa en profundidad: el esquema ya acota estos valores (1-12 semanas, ≤ 7 días)
  const weeks = toIntOrNull(plan.training_plan.weeks, 1, 12) ?? 4;
  const schedule = (plan.training_plan.weekly_schedule || []).slice(0, 7);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + weeks * 7);

  const byPublicId = new Map(catalog.map((ex) => [publicId(ex), ex]));

  return prisma.$transaction(async (tx) => {
    await tx.plan.updateMany({ where: { user_id: userId, status: 'active' }, data: { status: previousPlansStatus } });

    const saved = await tx.plan.create({
      data: {
        user_id: userId,
        type: 'combined',
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        generated_by_ai: Boolean(plan.generated_by_ai),
        ai_model_version: plan.model_version,
        ai_prompt_used: plan.generated_by_ai ? promptLabel : null,
      },
    });

    // Sesiones: semanas × días no de descanso (rangos ya acotados por el esquema)
    const planned = [];
    for (let week = 0; week < weeks; week++) {
      for (const day of schedule) {
        if (!day || day.session_type === 'rest') continue;
        if (!Number.isInteger(day.day_of_week) || day.day_of_week < 1 || day.day_of_week > 7) continue;
        planned.push({ date: sessionDateFor(startDate, week, day.day_of_week), day });
      }
    }
    planned.sort((a, b) => a.date - b.date);

    if (planned.length > 0) {
      await tx.trainingSession.createMany({
        data: planned.map(({ date, day }) => ({
          plan_id: saved.id,
          user_id: userId,
          scheduled_date: date,
          status: 'scheduled',
          notes: typeof day.notes === 'string' ? day.notes.slice(0, 500) : null,
        })),
      });

      if (catalog.length > 0) {
        const created = await tx.trainingSession.findMany({
          where: { plan_id: saved.id },
          orderBy: { scheduled_date: 'asc' },
          select: { id: true },
        });
        const sessionExercises = [];
        created.forEach((session, idx) => {
          const day = planned[idx] && planned[idx].day;
          const fromPlan = ((day && day.exercises) || [])
            .map((ex) => ({ ex, cat: byPublicId.get(String(ex.id)) }))
            .filter((x) => x.cat);
          if (fromPlan.length > 0) {
            fromPlan.forEach(({ ex, cat }, i) => sessionExercises.push({
              session_id: session.id,
              exercise_id: cat.id,
              sets: toIntOrNull(ex.sets, 1, 10) ?? 3,
              reps: toIntOrNull(ex.reps, 1, 100) ?? 12,
              rest_seconds: toIntOrNull(ex.rest_seconds, 0, 600) ?? 60,
              order_index: i + 1,
            }));
          } else {
            for (let i = 0; i < EXERCISES_PER_SESSION; i++) {
              const cat = catalog[(idx * EXERCISES_PER_SESSION + i) % catalog.length];
              sessionExercises.push({ session_id: session.id, exercise_id: cat.id, sets: 3, reps: 12, rest_seconds: 60, order_index: i + 1 });
            }
          }
        });
        if (sessionExercises.length > 0) await tx.sessionExercise.createMany({ data: sessionExercises });
      }
    }

    if (includeMeals) {
      const meals = [];
      for (let d = 0; d < 7; d++) {
        const mealDate = new Date(startDate);
        mealDate.setDate(startDate.getDate() + d);
        for (const s of (plan.nutrition_plan.meal_suggestions || []).slice(0, 16)) {
          meals.push({
            plan_id: saved.id,
            user_id: userId,
            meal_type: s.meal_type,
            scheduled_date: mealDate,
            calories: s.approximate_calories,
            protein_g: s.protein_g,
            carbs_g: s.carbs_g,
            fat_g: s.fat_g,
            status: 'scheduled',
          });
        }
      }
      if (meals.length > 0) await tx.meal.createMany({ data: meals });
    }

    return saved;
  }, { timeout: TX_TIMEOUT_MS });
}

module.exports = { persistGeneratedPlan, filterPlanExercisesByCatalog, sessionDateFor, EXERCISES_PER_SESSION };
