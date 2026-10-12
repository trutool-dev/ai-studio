/**
 * planStore — plan activo: entrenamiento, comidas, métricas y log diario.
 * Combina datos de API con fallback a datos mock para desarrollo offline.
 */

import { create } from 'zustand';
import api from '@/services/api';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface FoodItem {
  id: string; name: string; grams: number;
  calories: number; protein: number; carbs: number; fat: number;
}

export interface Meal {
  id: string; name: string; icon: string;
  foods: FoodItem[]; completed: boolean;
}

export interface SetRecord {
  id?:        string;
  weight_kg:  number;
  reps:       number;
  completed?: boolean;
}

export interface Exercise {
  id: string; name: string; muscleGroup: string;
  sets: number; reps: number; weight?: number; restSeconds: number;
  completed: boolean;
  loggedSets?: SetRecord[];
}

export interface WorkoutSession {
  id: string; name: string; muscleGroups: string[];
  durationMinutes: number; exercises: Exercise[];
  completed: boolean;
  estimatedCalories?: number;
}

export interface DayTargets {
  calories: number; protein: number; carbs: number; fat: number;
  waterMl: number; steps: number;
}

export interface DayLog {
  waterMl: number; steps: number; sleepHours: number;
  energy?: 1|2|3|4|5; mood?: 1|2|3|4|5;
}

export interface WeightEntry { date: string; value: number }

export interface ProgressStats {
  workoutsCompleted: number;
  kgLost:            number;
}

interface PlanState {
  todayWorkout:  WorkoutSession;
  todayMeals:    Meal[];
  targets:       DayTargets;
  log:           DayLog;
  streak:        number;
  weightHistory: WeightEntry[];
  progressStats: ProgressStats | null;

  // Estados de carga
  isLoadingTraining:  boolean;
  isLoadingNutrition: boolean;
  isLoadingProgress:  boolean;
  isLoadingLog:       boolean;

  // Acciones locales
  toggleExercise: (exerciseId: string) => void;
  toggleMeal:     (mealId: string)     => void;
  logWater:       (ml: number)         => void;
  logSteps:       (steps: number)      => void;
  logSleep:       (hours: number)      => void;

  // Acciones de API — Training
  fetchTodayTraining:  () => Promise<void>;
  logExerciseSet:      (sessionId: string, exerciseId: string, set: { weight_kg: number; reps: number }) => Promise<void>;
  completeSession:     (sessionId: string) => Promise<void>;

  // Acciones de API — Nutrition
  fetchTodayNutrition: () => Promise<void>;
  completeMeal:        (mealId: string)    => Promise<void>;

  // Acciones de API — Progress
  fetchProgress:       () => Promise<{ needs_plan_regeneration?: boolean } | undefined>;
  submitProgress:      (data: { weight_kg?: number; notes?: string }) => Promise<{ needs_plan_regeneration: boolean }>;
  regeneratePlan:      () => Promise<void>;

  // Acciones de API — Logs
  fetchTodayLog:       () => Promise<void>;
  submitLog:           (log: Partial<DayLog>) => Promise<void>;
}

// ── Datos mock (fallback offline) ────────────────────────────────────────────

const MOCK_WORKOUT: WorkoutSession = {
  id: 'w1', name: 'Pecho y Tríceps', muscleGroups: ['Pecho', 'Tríceps', 'Hombros'],
  durationMinutes: 55, completed: false, estimatedCalories: 350,
  exercises: [
    { id: 'e1', name: 'Press banca', muscleGroup: 'Pecho',    sets: 4, reps: 10, weight: 60, restSeconds: 90,  completed: false },
    { id: 'e2', name: 'Press inclinado mancuernas', muscleGroup: 'Pecho', sets: 3, reps: 12, weight: 22, restSeconds: 75,  completed: false },
    { id: 'e3', name: 'Aperturas en polea', muscleGroup: 'Pecho', sets: 3, reps: 15, weight: 12, restSeconds: 60, completed: false },
    { id: 'e4', name: 'Fondos en paralelas', muscleGroup: 'Tríceps', sets: 3, reps: 12, restSeconds: 75, completed: false },
    { id: 'e5', name: 'Press francés', muscleGroup: 'Tríceps', sets: 3, reps: 12, weight: 30, restSeconds: 60, completed: false },
    { id: 'e6', name: 'Elevaciones laterales', muscleGroup: 'Hombros', sets: 3, reps: 15, weight: 8, restSeconds: 60, completed: false },
  ],
};

const MOCK_MEALS: Meal[] = [
  { id: 'm1', name: 'Desayuno', icon: '☀️', completed: false,
    foods: [
      { id: 'f1', name: 'Avena con leche',     grams: 80,  calories: 310, protein: 12, carbs: 55, fat: 5  },
      { id: 'f2', name: 'Plátano',             grams: 100, calories:  89, protein:  1, carbs: 23, fat: 0  },
      { id: 'f3', name: 'Claras de huevo (3)', grams: 99,  calories:  50, protein: 10, carbs:  1, fat: 0  },
    ],
  },
  { id: 'm2', name: 'Media mañana', icon: '🥜', completed: false,
    foods: [
      { id: 'f4', name: 'Batido de proteínas', grams: 30,  calories: 120, protein: 25, carbs:  3, fat: 2  },
      { id: 'f5', name: 'Manzana',             grams: 150, calories:  78, protein:  0, carbs: 21, fat: 0  },
    ],
  },
  { id: 'm3', name: 'Almuerzo', icon: '🍽️', completed: false,
    foods: [
      { id: 'f6', name: 'Pechuga de pollo a la plancha', grams: 200, calories: 220, protein: 46, carbs:  0, fat: 4  },
      { id: 'f7', name: 'Arroz integral',                grams: 150, calories: 194, protein:  4, carbs: 41, fat: 2  },
      { id: 'f8', name: 'Brócoli al vapor',              grams: 200, calories:  68, protein:  6, carbs: 13, fat: 1  },
    ],
  },
  { id: 'm4', name: 'Merienda', icon: '🧃', completed: false,
    foods: [
      { id: 'f9',  name: 'Yogur griego 0%', grams: 200, calories: 118, protein: 20, carbs:  8, fat: 0 },
      { id: 'f10', name: 'Frutos rojos',    grams: 100, calories:  57, protein:  1, carbs: 14, fat: 0 },
    ],
  },
  { id: 'm5', name: 'Cena', icon: '🌙', completed: false,
    foods: [
      { id: 'f11', name: 'Salmón al horno',    grams: 180, calories: 367, protein: 36, carbs:  0, fat: 24 },
      { id: 'f12', name: 'Ensalada mixta',     grams: 200, calories:  50, protein:  3, carbs:  7, fat: 2  },
      { id: 'f13', name: 'Patata al vapor',    grams: 150, calories: 130, protein:  3, carbs: 30, fat: 0  },
    ],
  },
];

const MOCK_TARGETS: DayTargets = {
  calories: 2200, protein: 165, carbs: 242, fat: 61, waterMl: 2500, steps: 8000,
};

const MOCK_WEIGHT_HISTORY: WeightEntry[] = [
  { date: '01/04', value: 82.5 }, { date: '03/04', value: 82.1 },
  { date: '05/04', value: 81.8 }, { date: '08/04', value: 81.4 },
  { date: '10/04', value: 81.0 }, { date: '13/04', value: 80.6 },
  { date: '15/04', value: 80.2 }, { date: '17/04', value: 79.9 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normaliza la respuesta envuelta en { success, data } */
function unwrap<T>(response: { data: { data?: T } & T }): T {
  return (response.data as any).data ?? response.data;
}

// ── Store ────────────────────────────────────────────────────────────────────

export const usePlanStore = create<PlanState>((set, get) => ({
  todayWorkout:  MOCK_WORKOUT,
  todayMeals:    MOCK_MEALS,
  targets:       MOCK_TARGETS,
  streak:        7,
  weightHistory: MOCK_WEIGHT_HISTORY,
  progressStats: null,
  log: { waterMl: 750, steps: 3240, sleepHours: 7.5 },

  isLoadingTraining:  false,
  isLoadingNutrition: false,
  isLoadingProgress:  false,
  isLoadingLog:       false,

  // ── Acciones locales ───────────────────────────────────────────────────────

  toggleExercise: (id) => set((s) => ({
    todayWorkout: {
      ...s.todayWorkout,
      exercises: s.todayWorkout.exercises.map((e) =>
        e.id === id ? { ...e, completed: !e.completed } : e
      ),
    },
  })),

  toggleMeal: (id) => set((s) => ({
    todayMeals: s.todayMeals.map((m) =>
      m.id === id ? { ...m, completed: !m.completed } : m
    ),
  })),

  logWater: (ml) => set((s) => ({
    log: { ...s.log, waterMl: Math.min(s.log.waterMl + ml, s.targets.waterMl) },
  })),

  logSteps: (steps) => set((s) => ({ log: { ...s.log, steps } })),
  logSleep: (hours) => set((s) => ({ log: { ...s.log, sleepHours: hours } })),

  // ── Acciones de API — Training ─────────────────────────────────────────────

  fetchTodayTraining: async () => {
    set({ isLoadingTraining: true });
    try {
      const res = await api.get('/training/today');
      const session = unwrap<any>(res);
      if (session) {
        const workout: WorkoutSession = {
          id:               session.id,
          name:             session.name ?? 'Entrenamiento del día',
          muscleGroups:     session.muscle_groups ?? session.muscleGroups ?? [],
          durationMinutes:  session.duration_minutes ?? session.durationMinutes ?? 45,
          completed:        session.completed ?? false,
          estimatedCalories: session.estimated_calories ?? session.estimatedCalories,
          exercises:        (session.exercises ?? []).map((e: any) => ({
            id:           e.id,
            name:         e.name,
            muscleGroup:  e.muscle_group ?? e.muscleGroup ?? '',
            sets:         e.sets ?? 3,
            reps:         e.reps ?? 10,
            weight:       e.weight_kg ?? e.weight,
            restSeconds:  e.rest_seconds ?? e.restSeconds ?? 60,
            completed:    e.completed ?? false,
          })),
        };
        set({ todayWorkout: workout });
      }
    } catch {
      // Fallback a datos mock — no hay sesión del día o error de red
    } finally {
      set({ isLoadingTraining: false });
    }
  },

  logExerciseSet: async (sessionId, exerciseId, setData) => {
    await api.post(`/training/sessions/${sessionId}/exercises/${exerciseId}/sets`, setData);
    // Marcar el ejercicio como completado localmente
    get().toggleExercise(exerciseId);
  },

  completeSession: async (sessionId) => {
    await api.put(`/training/sessions/${sessionId}/complete`);
    set((s) => ({ todayWorkout: { ...s.todayWorkout, completed: true } }));
  },

  // ── Acciones de API — Nutrition ────────────────────────────────────────────

  fetchTodayNutrition: async () => {
    set({ isLoadingNutrition: true });
    try {
      const res = await api.get('/nutrition/today');
      const data = unwrap<any>(res);
      if (data) {
        const meals: Meal[] = (data.meals ?? []).map((m: any) => ({
          id:        m.id,
          name:      m.name,
          icon:      m.icon ?? '🍽️',
          completed: m.completed ?? false,
          foods:     (m.foods ?? []).map((f: any) => ({
            id:       f.id,
            name:     f.name,
            grams:    f.grams ?? 0,
            calories: f.calories ?? 0,
            protein:  f.protein ?? 0,
            carbs:    f.carbs ?? 0,
            fat:      f.fat ?? 0,
          })),
        }));

        const targets: DayTargets = {
          calories: data.targets?.calories ?? get().targets.calories,
          protein:  data.targets?.protein  ?? get().targets.protein,
          carbs:    data.targets?.carbs    ?? get().targets.carbs,
          fat:      data.targets?.fat      ?? get().targets.fat,
          waterMl:  data.targets?.water_ml ?? get().targets.waterMl,
          steps:    data.targets?.steps    ?? get().targets.steps,
        };

        set({ todayMeals: meals, targets });
      }
    } catch {
      // Fallback a mock
    } finally {
      set({ isLoadingNutrition: false });
    }
  },

  completeMeal: async (mealId) => {
    await api.put(`/nutrition/meals/${mealId}/complete`);
    get().toggleMeal(mealId);
  },

  // ── Acciones de API — Progress ─────────────────────────────────────────────

  fetchProgress: async () => {
    set({ isLoadingProgress: true });
    try {
      const [progressRes, statsRes] = await Promise.all([
        api.get('/progress'),
        api.get('/progress/stats'),
      ]);

      const entries   = unwrap<any[]>(progressRes) ?? [];
      const stats     = unwrap<any>(statsRes);

      const history: WeightEntry[] = entries
        .filter((e: any) => e.weight_kg)
        .slice(-10)
        .map((e: any) => ({
          date:  new Date(e.date ?? e.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
          value: e.weight_kg,
        }));

      if (history.length > 0) set({ weightHistory: history });
      if (stats?.streak)      set({ streak: stats.streak });

      // Estadísticas de perfil: entrenamientos completados y kg perdidos
      set({
        progressStats: {
          workoutsCompleted: stats?.workouts_completed ?? stats?.workoutsCompleted ?? 0,
          kgLost:            stats?.weight_lost_kg     ?? stats?.kgLost            ?? 0,
        },
      });

      return undefined;
    } catch {
      return undefined;
    } finally {
      set({ isLoadingProgress: false });
    }
  },

  submitProgress: async (data) => {
    const res = await api.post('/progress', data);
    const result = unwrap<any>(res);

    // Actualizar historial con nueva entrada
    if (data.weight_kg) {
      set((s) => ({
        weightHistory: [
          ...s.weightHistory,
          {
            date:  new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }),
            value: data.weight_kg!,
          },
        ],
      }));
    }

    return { needs_plan_regeneration: result?.needs_plan_regeneration ?? false };
  },

  regeneratePlan: async () => {
    // La IA puede tardar hasta 60s — timeout extendido solo para esta llamada
    await api.post('/plans/regenerate', { reason: 'manual_request' }, { timeout: 90000 });
  },

  // ── Acciones de API — Logs ─────────────────────────────────────────────────

  fetchTodayLog: async () => {
    set({ isLoadingLog: true });
    try {
      const res  = await api.get('/logs/today');
      const data = unwrap<any>(res);
      if (data) {
        set({
          log: {
            waterMl:    data.water_ml    ?? data.waterMl    ?? get().log.waterMl,
            steps:      data.steps       ?? get().log.steps,
            sleepHours: data.sleep_hours ?? data.sleepHours ?? get().log.sleepHours,
            energy:     data.energy,
            mood:       data.mood,
          },
        });
      }
    } catch {
      // Usar valores locales
    } finally {
      set({ isLoadingLog: false });
    }
  },

  submitLog: async (logData) => {
    const payload = {
      water_ml:    logData.waterMl,
      steps:       logData.steps,
      sleep_hours: logData.sleepHours,
      energy:      logData.energy,
      mood:        logData.mood,
    };
    await api.put('/logs/today', payload);
    set((s) => ({ log: { ...s.log, ...logData } }));
  },
}));

// ── Selectores derivados ─────────────────────────────────────────────────────

export function calcMealTotals(meal: Meal) {
  return meal.foods.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein:  acc.protein  + f.protein,
      carbs:    acc.carbs    + f.carbs,
      fat:      acc.fat      + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function calcDayTotals(meals: Meal[]) {
  return meals.reduce(
    (acc, m) => {
      const t = calcMealTotals(m);
      return {
        calories: acc.calories + t.calories,
        protein:  acc.protein  + t.protein,
        carbs:    acc.carbs    + t.carbs,
        fat:      acc.fat      + t.fat,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}
