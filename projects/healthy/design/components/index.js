/**
 * Índice del sistema de componentes Healthy
 * Importar desde aquí para mantener rutas limpias en el proyecto
 *
 * Ejemplo:
 *   import { Button, Input, Card, TabBar, NavHeader } from '@design/components';
 */

// ── Core ──────────────────────────────────────────────────────────────────────
export { Button }                                 from './Button';
export { Input }                                  from './Input';
export { Card, CardRow, CardDivider }             from './Card';
export { TabBar, NavHeader }                      from './Navigation';

// ── Progress & Metrics (Fitness+ / Whoop) ────────────────────────────────────
export { ProgressRing, ActivityRings, DailyProgressRing } from './ProgressRing';
export { MetricCard, RecoveryScore, MetricGrid }  from './MetricCard';

// ── Training (Apple Fitness+ style) ──────────────────────────────────────────
export { WorkoutCard, ExerciseRow, RestTimer, WorkoutSummary } from './WorkoutCard';
