/**
 * ProgressScreen — métricas, peso, racha, logros y registro de progreso.
 * FE-06: GET /progress + /progress/stats · POST /progress · POST /plans/regenerate.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, SafeAreaView, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View, Pressable,
} from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { usePlanStore }                           from '@/stores/planStore';
import { ActivityRings, DailyProgressRing }       from '@/components/ui/ProgressRing';
import { MetricCard, RecoveryScore, MetricGrid }  from '@/components/ui/MetricCard';
import { Button }                                 from '@/components/ui/Button';
import { colors }                                 from '@/theme/colors';
import { textStyles }                             from '@/theme/typography';
import { spacing, borderRadius, shadows }         from '@/theme/spacing';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBlock({ height = 20, width = '100%', style }: { height?: number; width?: number | string; style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[{ height, width: width as any, borderRadius: 8, backgroundColor: colors.neutral.lightGray, opacity, marginBottom: 8 }, style]} />;
}

// ── Gráfico de barras ─────────────────────────────────────────────────────────

function WeightChart({ entries }: { entries: { date: string; value: number }[] }) {
  if (entries.length === 0) return null;
  const values = entries.map((e) => e.value);
  const min    = Math.min(...values) - 1;
  const max    = Math.max(...values) + 1;
  const range  = max - min;

  return (
    <View style={chartStyles.wrapper}>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <View key={t} style={[chartStyles.gridLine, { bottom: `${t * 100}%` as any }]} />
      ))}
      <View style={chartStyles.bars}>
        {entries.map((e, i) => {
          const h      = range > 0 ? ((e.value - min) / range) * 100 : 50;
          const isLast = i === entries.length - 1;
          return (
            <View key={i} style={chartStyles.barCol}>
              <View style={[chartStyles.bar, { height: `${h}%` as any, backgroundColor: isLast ? colors.primary.green : colors.primary.lightGreen }]}>
                {isLast && <Text style={chartStyles.barLabel}>{e.value}</Text>}
              </View>
              <Text style={chartStyles.barDate}>{e.date}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Calendario de racha ───────────────────────────────────────────────────────

function StreakCalendar({ streak }: { streak: number }) {
  const days  = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const weeks = 4;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => weeks * 7 - 1 - i < streak);

  return (
    <View style={calStyles.grid}>
      {days.map((d) => <Text key={d} style={calStyles.dayLabel}>{d}</Text>)}
      {cells.map((done, i) => (
        <View key={i} style={[calStyles.cell, done && calStyles.cellDone]} />
      ))}
    </View>
  );
}

// ── Modal de registro de progreso ─────────────────────────────────────────────

interface ProgressModalProps {
  visible:   boolean;
  onSubmit:  (weight: number, notes: string) => void;
  onClose:   () => void;
  submitting: boolean;
}

function ProgressModal({ visible, onSubmit, onClose, submitting }: ProgressModalProps) {
  const [weight, setWeight] = useState('');
  const [notes,  setNotes]  = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pmStyles.overlay}>
        <View style={pmStyles.sheet}>
          <Text style={pmStyles.title}>Registrar progreso</Text>
          <View style={pmStyles.field}>
            <Text style={pmStyles.fieldLabel}>Peso actual (kg) — opcional</Text>
            <TextInput
              style={pmStyles.input}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="Ej: 80.5"
              placeholderTextColor={colors.neutral.midGray}
              accessibilityLabel="Peso en kilogramos"
            />
          </View>
          <View style={pmStyles.field}>
            <Text style={pmStyles.fieldLabel}>Notas — opcional</Text>
            <TextInput
              style={[pmStyles.input, { height: 80, textAlignVertical: 'top' }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="¿Cómo te has sentido esta semana?"
              placeholderTextColor={colors.neutral.midGray}
              accessibilityLabel="Notas de progreso"
            />
          </View>
          <View style={pmStyles.btns}>
            <Button label="Cancelar" variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              label="Guardar"
              variant="primary"
              loading={submitting}
              onPress={() => onSubmit(parseFloat(weight) || 0, notes)}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Modal de regeneración de plan ─────────────────────────────────────────────

interface RegenModalProps {
  visible:      boolean;
  onConfirm:    () => void;
  onDismiss:    () => void;
  regenerating: boolean;
}

function RegenModal({ visible, onConfirm, onDismiss, regenerating }: RegenModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={regenStyles.overlay}>
        <View style={regenStyles.card}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>🔄</Text>
          <Text style={regenStyles.title}>¿Actualizar tu plan?</Text>
          <Text style={regenStyles.body}>
            Tu progreso sugiere que tu plan actual podría optimizarse. ¿Quieres que la IA regenere tu plan con los nuevos datos?
          </Text>
          <Button label="Sí, regenerar plan" variant="primary" loading={regenerating} onPress={onConfirm} />
          <Button label="Mantener el actual" variant="ghost"   onPress={onDismiss}    style={{ marginTop: spacing.sm }} />
        </View>
      </View>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

const PERIODS = ['Semana', 'Mes', '3 meses'];

const ACHIEVEMENTS = [
  { id: 'a1', icon: '🌱', label: 'Primera semana',  unlocked: true  },
  { id: 'a2', icon: '🔥', label: '7 días de racha', unlocked: true  },
  { id: 'a3', icon: '💪', label: '10 entrenos',     unlocked: true  },
  { id: 'a4', icon: '⚖️', label: '-5 kg',           unlocked: false },
  { id: 'a5', icon: '🏆', label: '30 días racha',   unlocked: false },
  { id: 'a6', icon: '🥗', label: 'Mes perfecto',    unlocked: false },
];

export function ProgressScreen() {
  const {
    weightHistory, streak,
    todayWorkout, todayMeals,
    fetchProgress, submitProgress, regeneratePlan,
    isLoadingProgress,
  } = usePlanStore();

  const [period, setPeriod]     = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [showRegen, setShowRegen]       = useState(false);
  const [submitting,    setSubmitting]  = useState(false);
  const [regenerating,  setRegenerating] = useState(false);

  // Press feedback para el botón "+ Registrar"
  const addBtnScale = useSharedValue(1);
  const addBtnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: addBtnScale.value }] }));
  const addBtnCfg = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

  useEffect(() => { fetchProgress(); }, []);

  const lastWeight  = weightHistory.at(-1)?.value ?? 0;
  const firstWeight = weightHistory[0]?.value      ?? 0;
  const weightDiff  = +(firstWeight - lastWeight).toFixed(1);

  const mealsCompleted = todayMeals.filter((m) => m.completed).length;
  const exCompleted    = todayWorkout.exercises.filter((e) => e.completed).length;
  const totalCount     = todayWorkout.exercises.length;
  const pct            = totalCount > 0 ? exCompleted / totalCount : 0;
  const allDone        = exCompleted === totalCount && totalCount > 0;

  const handleSubmitProgress = async (weight: number, notes: string) => {
    setSubmitting(true);
    try {
      const result = await submitProgress({ weight_kg: weight || undefined, notes: notes || undefined });
      setShowProgress(false);
      if (result.needs_plan_regeneration) {
        setShowRegen(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await regeneratePlan();
      setShowRegen(false);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.headerRow}>
          <Text style={styles.title}>Mi progreso</Text>
          <ReAnimated.View style={addBtnAnimStyle}>
            <Pressable
              onPress={() => setShowProgress(true)}
              onPressIn={() => { addBtnScale.value = withTiming(0.97, addBtnCfg); }}
              onPressOut={() => { addBtnScale.value = withTiming(1, addBtnCfg); }}
              style={styles.addBtn}
              accessibilityLabel="Registrar nuevo progreso"
            >
              <Text style={styles.addBtnText}>+ Registrar</Text>
            </Pressable>
          </ReAnimated.View>
        </View>

        {/* Score de recuperación protagonista */}
        <RecoveryScore
          score={Math.round((exCompleted / Math.max(totalCount, 1)) * 100)}
          message={allDone ? 'Objetivos del día completados' : 'Sigue con tu plan'}
          hrv={undefined}
          restingHr={undefined}
        />

        {/* Cuadrícula de métricas */}
        <MetricGrid
          metrics={[
            {
              label:       'Peso actual',
              value:       `${lastWeight}`,
              unit:        'kg',
              trend:       weightDiff > 0 ? -weightDiff : weightDiff,
              trendLabel:  'total',
              accentColor: colors.primary.darkGreen,
              icon:        '⚖️',
            },
            {
              label:       'Racha',
              value:       `${streak}`,
              unit:        'días',
              accentColor: '#F59E0B',
              icon:        '🔥',
            },
            {
              label:       'Entrenos',
              value:       '12',
              unit:        'este mes',
              accentColor: colors.semantic.info,
              icon:        '💪',
            },
            {
              label:       'Comidas',
              value:       `${mealsCompleted}`,
              unit:        `/ ${todayMeals.length}`,
              accentColor: '#16A34A',
              icon:        '🥗',
            },
          ]}
        />

        {/* Selector de período */}
        <View style={styles.periodRow}>
          {PERIODS.map((p, i) => (
            <Pressable
              key={p}
              onPress={() => setPeriod(i)}
              style={[styles.periodBtn, period === i && styles.periodBtnActive]}
              accessibilityLabel={p}
              accessibilityState={{ selected: period === i }}
            >
              <Text style={[styles.periodText, period === i && styles.periodTextActive]}>{p}</Text>
            </Pressable>
          ))}
        </View>

        {/* Anillos de actividad */}
        <View style={styles.ringsWrapper}>
          <ActivityRings
            move={pct}
            exercise={exCompleted / Math.max(totalCount, 1)}
            stand={mealsCompleted / Math.max(todayMeals.length, 1)}
            size={140}
          />
        </View>

        {/* Skeleton si cargando */}
        {isLoadingProgress && (
          <View style={{ gap: spacing.sm }}>
            <SkeletonBlock height={140} />
            <SkeletonBlock height={80} />
          </View>
        )}

        {/* Gráfico de peso */}
        {!isLoadingProgress && (
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Evolución del peso</Text>
              <Text style={styles.chartDiff}>
                {weightDiff > 0
                  ? <Text style={{ color: colors.primary.darkGreen }}>↓ -{weightDiff} kg</Text>
                  : <Text style={{ color: '#DC2626' }}>↑ +{Math.abs(weightDiff)} kg</Text>
                }
              </Text>
            </View>
            <WeightChart entries={weightHistory} />
          </View>
        )}

        {/* Racha */}
        <View style={styles.sectionCard}>
          <View style={styles.streakHeader}>
            <Text style={styles.sectionTitle}>Racha de entrenamiento 🔥</Text>
            <View style={styles.streakBadge}>
              <Text style={styles.streakNum}>{streak}</Text>
              <Text style={styles.streakLabel}>días</Text>
            </View>
          </View>
          <StreakCalendar streak={streak} />
          <Text style={styles.streakHint}>¡Sigue así! Cada día cuenta para tu racha.</Text>
        </View>

        {/* Resumen de hoy */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Resumen de hoy</Text>
          <View style={styles.todaySummary}>
            <TodayRow icon="🥗" label="Comidas"    value={`${mealsCompleted}/${todayMeals.length}`}          done={mealsCompleted === todayMeals.length} />
            <TodayRow icon="🏋️" label="Ejercicios" value={`${exCompleted}/${todayWorkout.exercises.length}`} done={exCompleted === todayWorkout.exercises.length} />
          </View>
        </View>

        {/* Logros */}
        <Text style={styles.achievementsTitle}>Logros</Text>
        <View style={styles.achievementsRow}>
          {ACHIEVEMENTS.map((a) => (
            <View key={a.id} style={[styles.achievement, !a.unlocked && styles.achievementLocked]}>
              <Text style={[styles.achievementIcon, !a.unlocked && styles.achievementIconLocked]}>{a.icon}</Text>
              <Text style={[styles.achievementLabel, !a.unlocked && styles.achievementLabelLocked]}>{a.label}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Modales */}
      <ProgressModal
        visible={showProgress}
        onSubmit={handleSubmitProgress}
        onClose={() => setShowProgress(false)}
        submitting={submitting}
      />
      <RegenModal
        visible={showRegen}
        onConfirm={handleRegenerate}
        onDismiss={() => setShowRegen(false)}
        regenerating={regenerating}
      />
    </SafeAreaView>
  );
}

function TodayRow({ icon, label, value, done }: { icon: string; label: string; value: string; done: boolean }) {
  return (
    <View style={todayStyles.row}>
      <Text style={todayStyles.icon}>{icon}</Text>
      <Text style={todayStyles.label}>{label}</Text>
      <Text style={[todayStyles.value, done && todayStyles.valueDone]}>{value}</Text>
      {done && <Text style={todayStyles.check}>✓</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.offWhite },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  title:     { ...textStyles.titleMedium, color: colors.neutral.black },
  addBtn:    { backgroundColor: colors.primary.darkGreen, borderRadius: borderRadius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addBtnText:{ ...textStyles.caption, color: colors.neutral.white, fontWeight: '700' },

  periodRow:        { flexDirection: 'row', backgroundColor: colors.neutral.lightGray, borderRadius: borderRadius.pill, padding: 3, marginBottom: spacing.lg },
  periodBtn:        { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.pill },
  periodBtnActive:  { backgroundColor: colors.neutral.white, ...shadows.card },
  periodText:       { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  periodTextActive: { color: colors.neutral.darkGray, fontWeight: '600' },

  ringsWrapper: { alignItems: 'center', marginBottom: spacing.lg },

  chartCard: { backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, padding: spacing.lg, ...shadows.card, marginBottom: spacing.lg },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  chartTitle:  { ...textStyles.bodyLarge, fontWeight: '600', color: colors.neutral.black },
  chartDiff:   { ...textStyles.bodyNormal, fontWeight: '700' },

  sectionCard:  { backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, padding: spacing.lg, ...shadows.card, marginBottom: spacing.lg },
  sectionTitle: { ...textStyles.bodyLarge, fontWeight: '600', color: colors.neutral.black, marginBottom: spacing.md },

  streakHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  streakBadge:  { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: '#FEF3C7', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.pill },
  streakNum:    { ...textStyles.titleSmall, color: '#D97706' },
  streakLabel:  { ...textStyles.caption, color: '#92400E' },
  streakHint:   { ...textStyles.caption, color: colors.neutral.midGray, textAlign: 'center', marginTop: spacing.md },

  todaySummary: { gap: spacing.sm },

  achievementsTitle: { ...textStyles.titleSmall, color: colors.neutral.black, marginBottom: spacing.md },
  achievementsRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievement: { alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 80, backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, padding: spacing.md, ...shadows.card, borderWidth: 1.5, borderColor: colors.primary.lightGreen },
  achievementLocked:       { borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite },
  achievementIcon:         { fontSize: 28 },
  achievementIconLocked:   { opacity: 0.3 },
  achievementLabel:        { ...textStyles.caption, color: colors.neutral.darkGray, fontWeight: '600', textAlign: 'center' },
  achievementLabelLocked:  { color: colors.neutral.midGray },
});

const chartStyles = StyleSheet.create({
  wrapper:  { height: 140, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.neutral.lightGray },
  bars:     { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  barCol:   { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar:      { width: '80%', borderRadius: 4, minHeight: 8, justifyContent: 'flex-start', alignItems: 'center' },
  barLabel: { ...textStyles.caption, color: colors.primary.darkGreen, fontWeight: '700', marginTop: -18 },
  barDate:  { ...textStyles.caption, color: colors.neutral.midGray, marginTop: 4, fontSize: 9 },
});

const calStyles = StyleSheet.create({
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayLabel: { width: 28, textAlign: 'center', ...textStyles.caption, color: colors.neutral.midGray, fontWeight: '600' },
  cell:     { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.neutral.lightGray },
  cellDone: { backgroundColor: colors.primary.green },
});

const todayStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  icon:      { fontSize: 20, width: 28, textAlign: 'center' },
  label:     { ...textStyles.bodyNormal, color: colors.neutral.darkGray, flex: 1 },
  value:     { ...textStyles.bodyNormal, color: colors.neutral.midGray, fontWeight: '700' },
  valueDone: { color: colors.primary.darkGreen },
  check:     { color: colors.primary.darkGreen, fontWeight: '700', fontSize: 16 },
});

const pmStyles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: colors.neutral.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.xl, gap: spacing.lg },
  title:      { ...textStyles.titleSmall, color: colors.neutral.black },
  field:      { gap: spacing.xs },
  fieldLabel: { ...textStyles.caption, color: colors.neutral.midGray, fontWeight: '600' },
  input:      { borderRadius: borderRadius.input, borderWidth: 1.5, borderColor: colors.neutral.lightGray, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  btns:       { flexDirection: 'row', gap: spacing.md },
});

const regenStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card:    { backgroundColor: colors.neutral.white, borderRadius: 24, padding: spacing.xl, gap: spacing.lg, width: '100%' },
  title:   { ...textStyles.titleSmall, color: colors.neutral.black, textAlign: 'center' },
  body:    { ...textStyles.bodyNormal, color: colors.neutral.midGray, textAlign: 'center', lineHeight: 22 },
});

export default ProgressScreen;
