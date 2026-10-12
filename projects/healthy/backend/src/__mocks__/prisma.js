/**
 * Mock con estado en memoria del cliente Prisma.
 * Implementa operaciones CRUD reales sobre colecciones JS en memoria,
 * de modo que los tests de integración puedan usar la misma instancia
 * tanto desde los controladores como en las aserciones directas.
 *
 * Modelos soportados (según schema.prisma):
 *   user, verificationCode, passwordResetToken, authSession,
 *   profile, lifestyleProfile, trainingPreferences, healthCondition,
 *   nutritionPreferences, foodRestriction, motivationProfile,
 *   onboardingAnswer, plan, trainingSession, exercise, sessionExercise,
 *   meal, food, mealFood, progressLog, dailyLog, tokenUsageLog
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── Base de datos en memoria ────────────────────────────────────────────────

const db = {
  user: [],
  verificationCode: [],
  passwordResetToken: [],
  authSession: [],
  profile: [],
  lifestyleProfile: [],
  trainingPreferences: [],
  healthCondition: [],
  nutritionPreferences: [],
  foodRestriction: [],
  motivationProfile: [],
  onboardingAnswer: [],
  plan: [],
  trainingSession: [],
  exercise: [],
  sessionExercise: [],
  meal: [],
  food: [],
  mealFood: [],
  progressLog: [],
  dailyLog: [],
  tokenUsageLog: [],
};

// ─── Utilidades de filtrado ──────────────────────────────────────────────────

/**
 * Evalúa un objeto where de Prisma contra un registro.
 * Soporta: igualdad directa, { gt, gte, lt, lte, not, in, contains, startsWith, endsWith },
 * { gte+lte } para rangos, AND, OR, NOT implícitos.
 */
function matchesWhere(record, where) {
  if (!where) return true;
  for (const [key, condition] of Object.entries(where)) {
    if (key === 'AND') {
      if (!condition.every((c) => matchesWhere(record, c))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!condition.some((c) => matchesWhere(record, c))) return false;
      continue;
    }
    if (key === 'NOT') {
      const notConds = Array.isArray(condition) ? condition : [condition];
      if (notConds.some((c) => matchesWhere(record, c))) return false;
      continue;
    }

    const value = record[key];

    if (condition === null) {
      if (value !== null && value !== undefined) return false;
      continue;
    }

    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition) && !(condition instanceof Date)) {
      // objeto de condición Prisma
      if ('equals' in condition) {
        if (value !== condition.equals) return false;
      }
      if ('not' in condition) {
        if (value === condition.not) return false;
      }
      if ('in' in condition) {
        if (!condition.in.includes(value)) return false;
      }
      if ('notIn' in condition) {
        if (condition.notIn.includes(value)) return false;
      }
      if ('gt' in condition) {
        if (!(toComparable(value) > toComparable(condition.gt))) return false;
      }
      if ('gte' in condition) {
        if (!(toComparable(value) >= toComparable(condition.gte))) return false;
      }
      if ('lt' in condition) {
        if (!(toComparable(value) < toComparable(condition.lt))) return false;
      }
      if ('lte' in condition) {
        if (!(toComparable(value) <= toComparable(condition.lte))) return false;
      }
      if ('contains' in condition) {
        const str = String(value || '');
        const search = String(condition.contains);
        const mode = condition.mode === 'insensitive';
        if (mode ? !str.toLowerCase().includes(search.toLowerCase()) : !str.includes(search)) return false;
      }
      if ('startsWith' in condition) {
        if (!String(value || '').startsWith(String(condition.startsWith))) return false;
      }
      if ('endsWith' in condition) {
        if (!String(value || '').endsWith(String(condition.endsWith))) return false;
      }
    } else {
      // igualdad directa
      if (!looseEqual(value, condition)) return false;
    }
  }
  return true;
}

function toComparable(v) {
  if (v instanceof Date) return v.getTime();
  return v;
}

function looseEqual(a, b) {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof Date) return a.getTime() === new Date(b).getTime();
  if (b instanceof Date) return new Date(a).getTime() === b.getTime();
  return a === b;
}

function applyOrderBy(records, orderBy) {
  if (!orderBy) return records;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...records].sort((a, b) => {
    for (const order of orders) {
      for (const [field, dir] of Object.entries(order)) {
        const av = toComparable(a[field]);
        const bv = toComparable(b[field]);
        if (av < bv) return dir === 'asc' ? -1 : 1;
        if (av > bv) return dir === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });
}

function applySelect(record, select) {
  if (!select || !record) return record;
  const result = {};
  for (const [key, val] of Object.entries(select)) {
    if (val === true) {
      result[key] = record[key];
    } else if (val && typeof val === 'object') {
      // relación con sub-select — resolvemos perezosamente
      result[key] = record[key] !== undefined ? applySelect(record[key], val.select || val) : undefined;
    }
  }
  return result;
}

function applyInclude(record, include, allDb) {
  if (!include || !record) return record;
  const result = { ...record };
  for (const [rel, val] of Object.entries(include)) {
    if (!val) continue;
    // Resolución básica de relaciones conocidas
    const resolved = resolveRelation(record, rel, allDb, val);
    result[rel] = resolved;
  }
  return result;
}

// Resolución de relaciones por convención de nombres
function resolveRelation(record, rel, allDb, opts) {
  const subSelect = opts === true ? null : (opts.select || null);
  const subInclude = opts === true ? null : (opts.include || null);

  // user → busca por user_id
  if (rel === 'user') {
    const found = allDb.user.find((u) => u.id === record.user_id);
    if (!found) return null;
    let r = { ...found };
    if (subSelect) r = applySelect(r, subSelect);
    if (subInclude) r = applyInclude(r, subInclude, allDb);
    return r;
  }
  if (rel === 'profile') {
    const found = allDb.profile.find((p) => p.user_id === record.id);
    return found ? { ...found } : null;
  }
  if (rel === 'session' || rel === 'authSession') {
    return allDb.authSession.find((s) => s.id === record.session_id) || null;
  }
  // Por defecto devolvemos undefined
  return undefined;
}

// ─── Valores por defecto por tabla (campos null o con default en el schema) ──

const TABLE_DEFAULTS = {
  verificationCode: { used_at: null, attempts: 0 },
  passwordResetToken: { used_at: null },
  authSession: { last_used_at: null },
  user: {
    phone_number: null,
    email_verified: false,
    phone_verified: false,
    status: 'pending_verification',
    health_consent_given_at: null,
    health_consent_version: null,
  },
  profile: {
    gender: null,
    weight_kg: null,
    height_cm: null,
    body_type: null,
    activity_level: null,
    goal: null,
    daily_calories_target: null,
    daily_protein_target: null,
    daily_carbs_target: null,
    daily_fat_target: null,
  },
  plan: { ai_prompt_used: null, ai_model_version: null, end_date: null },
  trainingSession: { completed_at: null, duration_minutes: null, calories_burned: null, notes: null },
  dailyLog: { water_ml: null, sleep_hours: null, sleep_quality: null, energy_level: null, mood: null, steps: null },
  progressLog: { weight_kg: null, body_fat_percentage: null, muscle_mass_kg: null, waist_cm: null, hip_cm: null, chest_cm: null, notes: null, photo_url: null },
};

// ─── Generador de modelos ────────────────────────────────────────────────────

function makeModel(table) {
  return {
    // findUnique — busca por id o por campo único
    findUnique: jest.fn(async ({ where, select, include } = {}) => {
      let record = null;
      if (where) {
        if (where.id) {
          record = db[table].find((r) => r.id === where.id) || null;
        } else if (where.email) {
          record = db[table].find((r) => r.email === where.email) || null;
        } else if (where.token) {
          record = db[table].find((r) => r.token === where.token) || null;
        } else if (where.refresh_token) {
          record = db[table].find((r) => r.refresh_token === where.refresh_token) || null;
        } else if (where.user_id) {
          record = db[table].find((r) => r.user_id === where.user_id) || null;
        } else if (where.barcode) {
          record = db[table].find((r) => r.barcode === where.barcode) || null;
        } else if (where.user_id_log_date) {
          // unique compuesto: { user_id, log_date }
          const { user_id, log_date } = where.user_id_log_date;
          record = db[table].find((r) =>
            r.user_id === user_id && looseEqual(r.log_date, log_date)
          ) || null;
        } else {
          // Buscar por cualquier campo único
          record = db[table].find((r) => matchesWhere(r, where)) || null;
        }
      }
      if (!record) return null;
      record = { ...record };
      if (include) record = applyInclude(record, include, db);
      if (select) record = applySelect(record, select);
      return record;
    }),

    // findFirst — busca el primero que cumple where + orderBy
    findFirst: jest.fn(async ({ where, orderBy, select, include } = {}) => {
      let filtered = db[table].filter((r) => matchesWhere(r, where));
      if (orderBy) filtered = applyOrderBy(filtered, orderBy);
      let record = filtered[0] || null;
      if (!record) return null;
      record = { ...record };
      if (include) record = applyInclude(record, include, db);
      if (select) record = applySelect(record, select);
      return record;
    }),

    // findMany
    findMany: jest.fn(async ({ where, orderBy, select, include, take, skip } = {}) => {
      let filtered = db[table].filter((r) => matchesWhere(r, where));
      if (orderBy) filtered = applyOrderBy(filtered, orderBy);
      if (skip) filtered = filtered.slice(skip);
      if (take) filtered = filtered.slice(0, take);
      return filtered.map((r) => {
        let rec = { ...r };
        if (include) rec = applyInclude(rec, include, db);
        if (select) rec = applySelect(rec, select);
        return rec;
      });
    }),

    // create
    create: jest.fn(async ({ data, select, include } = {}) => {
      const record = {
        id: uuidv4(),
        created_at: new Date(),
        updated_at: new Date(),
        ...(TABLE_DEFAULTS[table] || {}),
        ...data,
      };
      db[table].push(record);
      let result = { ...record };
      if (include) result = applyInclude(result, include, db);
      if (select) result = applySelect(result, select);
      return result;
    }),

    // update
    update: jest.fn(async ({ where, data, select, include } = {}) => {
      let idx = -1;
      if (where.id) {
        idx = db[table].findIndex((r) => r.id === where.id);
      } else if (where.user_id_log_date) {
        const { user_id, log_date } = where.user_id_log_date;
        idx = db[table].findIndex((r) =>
          r.user_id === user_id && looseEqual(r.log_date, log_date)
        );
      } else {
        idx = db[table].findIndex((r) => matchesWhere(r, where));
      }
      if (idx === -1) {
        throw new Error(`[prisma mock] ${table}.update: registro no encontrado con where=${JSON.stringify(where)}`);
      }
      db[table][idx] = { ...db[table][idx], ...data, updated_at: new Date() };
      let result = { ...db[table][idx] };
      if (include) result = applyInclude(result, include, db);
      if (select) result = applySelect(result, select);
      return result;
    }),

    // updateMany
    updateMany: jest.fn(async ({ where, data } = {}) => {
      let count = 0;
      db[table] = db[table].map((r) => {
        if (matchesWhere(r, where)) {
          count++;
          return { ...r, ...data, updated_at: new Date() };
        }
        return r;
      });
      return { count };
    }),

    // upsert
    upsert: jest.fn(async ({ where, create, update, select, include } = {}) => {
      let idx = -1;
      if (where.id) {
        idx = db[table].findIndex((r) => r.id === where.id);
      } else if (where.user_id) {
        idx = db[table].findIndex((r) => r.user_id === where.user_id);
      } else {
        idx = db[table].findIndex((r) => matchesWhere(r, where));
      }

      let record;
      if (idx === -1) {
        record = { id: uuidv4(), created_at: new Date(), updated_at: new Date(), ...create };
        db[table].push(record);
      } else {
        db[table][idx] = { ...db[table][idx], ...update, updated_at: new Date() };
        record = db[table][idx];
      }
      let result = { ...record };
      if (include) result = applyInclude(result, include, db);
      if (select) result = applySelect(result, select);
      return result;
    }),

    // delete
    delete: jest.fn(async ({ where } = {}) => {
      const idx = db[table].findIndex((r) => {
        if (where.id) return r.id === where.id;
        return matchesWhere(r, where);
      });
      if (idx === -1) return null;
      const [deleted] = db[table].splice(idx, 1);
      return { ...deleted };
    }),

    // deleteMany
    deleteMany: jest.fn(async ({ where } = {}) => {
      const before = db[table].length;
      db[table] = db[table].filter((r) => !matchesWhere(r, where));
      return { count: before - db[table].length };
    }),

    // count
    count: jest.fn(async ({ where } = {}) => {
      return db[table].filter((r) => matchesWhere(r, where)).length;
    }),

    // createMany
    createMany: jest.fn(async ({ data, skipDuplicates } = {}) => {
      const items = Array.isArray(data) ? data : [data];
      const created = [];
      for (const item of items) {
        const record = {
          id: uuidv4(),
          created_at: new Date(),
          updated_at: new Date(),
          ...(TABLE_DEFAULTS[table] || {}),
          ...item,
        };
        if (skipDuplicates) {
          // Verificación básica de duplicados por id
          const exists = db[table].some((r) => r.id === record.id);
          if (!exists) {
            db[table].push(record);
            created.push(record);
          }
        } else {
          db[table].push(record);
          created.push(record);
        }
      }
      return { count: created.length };
    }),
  };
}

// ─── Instancia del mock ──────────────────────────────────────────────────────

const prismaMock = {
  user: makeModel('user'),
  verificationCode: makeModel('verificationCode'),
  passwordResetToken: makeModel('passwordResetToken'),
  authSession: makeModel('authSession'),
  profile: makeModel('profile'),
  lifestyleProfile: makeModel('lifestyleProfile'),
  trainingPreferences: makeModel('trainingPreferences'),
  healthCondition: makeModel('healthCondition'),
  nutritionPreferences: makeModel('nutritionPreferences'),
  foodRestriction: makeModel('foodRestriction'),
  motivationProfile: makeModel('motivationProfile'),
  onboardingAnswer: makeModel('onboardingAnswer'),
  plan: makeModel('plan'),
  trainingSession: makeModel('trainingSession'),
  exercise: makeModel('exercise'),
  sessionExercise: makeModel('sessionExercise'),
  meal: makeModel('meal'),
  food: makeModel('food'),
  mealFood: makeModel('mealFood'),
  progressLog: makeModel('progressLog'),
  dailyLog: makeModel('dailyLog'),
  tokenUsageLog: makeModel('tokenUsageLog'),

  // $transaction: ejecuta un array de promesas o una función
  $transaction: jest.fn(async (arg) => {
    if (typeof arg === 'function') {
      return arg(prismaMock);
    }
    // Array de operaciones ya en Promise
    return Promise.all(arg);
  }),

  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),

  $disconnect: jest.fn().mockResolvedValue(undefined),

  // Expone la BD en memoria para que los tests puedan resetearla
  _db: db,

  // Helper para limpiar toda la BD entre tests si hace falta
  _reset() {
    for (const table of Object.keys(db)) {
      db[table] = [];
    }
  },
};

module.exports = prismaMock;
