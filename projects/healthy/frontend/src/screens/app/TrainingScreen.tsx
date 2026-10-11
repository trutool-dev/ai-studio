/**
 * TrainingScreen — sesión de entrenamiento del día con conexión al backend.
 * FE-04: GET /training/today + POST sets + PUT session complete.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withRepeat, withTiming, Easing,
  interpolate, Extrapolation, ReduceMotion,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { usePlanStore }   from '@/stores/planStore';
import { WorkoutCard, ExerciseRow, RestTimer, WorkoutSummary } from '@/components/ui/WorkoutCard';
import { DailyProgressRing } from '@/components/ui/ProgressRing';
import { Button }         from '@/components/ui/Button';
import { colors }         from '@/theme/colors';
import { textStyles }     from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

// ── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonBlock({ height = 20, width = '100%', style }: { height?: number; width?: number | string; style?: object }) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,   // infinito
      true  // reverse
    );
  }, []);

  const skeletonStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Reanimated.View
      style={[{ height, width: width as any, borderRadius: 8, backgroundColor: colors.neutral.lightGray }, skeletonStyle, style]}
    />
  );
}

function TrainingSkeleton() {
  return (
    <View style={{ gap: spacing.lg, padding: spacing.lg }}>
      <SkeletonBlock height={160} />
      <SkeletonBlock height={24} width="60%" />
      <SkeletonBlock height={16} width="40%" />
      {[1,2,3,4].map(i => <SkeletonBlock key={i} height={56} />)}
    </View>
  );
}

// ── Helpers para el bottom sheet ─────────────────────────────────────────────

function project(velocity: number, decelerationRate = 0.998): number {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

const SHEET_HEIGHT = 320;

// ── Bottom sheet para registrar una serie ────────────────────────────────────

interface SetSheetProps {
  exerciseName: string;
  defaultWeight?: number;
  defaultReps?:   number;
  onConfirm:   (weight: number, reps: number) => void;
  onClose:     () => void;
}

function SetSheet({ exerciseName, defaultWeight = 0, defaultReps = 10, onConfirm, onClose }: SetSheetProps) {
  const [weight, setWeight] = useState(String(defaultWeight));
  const [reps,   setReps]   = useState(String(defaultReps));

  const translateY = useSharedValue(SHEET_HEIGHT);
  const context    = useSharedValue(0);

  // Abrir al montar
  useEffect(() => {
    translateY.value = withSpring(0, { duration: 300, dampingRatio: 0.8, reduceMotion: ReduceMotion.System });
  }, []);

  const closeSheet = useCallback(() => {
    translateY.value = withSpring(SHEET_HEIGHT, { duration: 300, dampingRatio: 1, overshootClamping: true, reduceMotion: ReduceMotion.System });
    scheduleOnRN(onClose);
  }, [onClose]);

  const pan = useMemo(() => Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() => { context.value = translateY.value; })
    .onUpdate((e) => {
      const next = context.value + e.translationY;
      translateY.value = next >= 0 ? next : rubberband(next, SHEET_HEIGHT);
    })
    .onEnd((e) => {
      const projected = translateY.value + project(e.velocityY);
      if (projected > SHEET_HEIGHT * 0.4) {
        translateY.value = withSpring(SHEET_HEIGHT, { duration: 300, dampingRatio: 1, velocity: e.velocityY, overshootClamping: true, reduceMotion: ReduceMotion.System });
        scheduleOnRN(onClose);
      } else {
        translateY.value = withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY, reduceMotion: ReduceMotion.System });
        scheduleOnRN(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      }
    }), [onClose]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, SHEET_HEIGHT], [0.5, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={sheet.container} pointerEvents="box-none">
      {/* Fondo oscuro */}
      <Reanimated.View style={[sheet.backdrop, backdropStyle]} pointerEvents="box-none">
        <Pressable style={{ flex: 1 }} onPress={closeSheet} accessibilityLabel="Cerrar sheet" />
      </Reanimated.View>

      {/* Sheet */}
      <GestureDetector gesture={pan}>
        <Reanimated.View style={[sheet.sheet, sheetStyle]}>
          {/* Handle */}
          <View style={sheet.handle} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Text style={modal.title}>Registrar serie</Text>
            <Text style={modal.subtitle}>{exerciseName}</Text>
            <View style={modal.row}>
              <View style={modal.field}>
                <Text style={modal.fieldLabel}>Peso (kg)</Text>
                <TextInput
                  style={modal.input}
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Peso en kilogramos"
                />
              </View>
              <View style={modal.field}>
                <Text style={modal.fieldLabel}>Repeticiones</Text>
                <TextInput
                  style={modal.input}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  accessibilityLabel="Número de repeticiones"
                />
              </View>
            </View>
            <View style={modal.btns}>
              <Button label="Cancelar" variant="secondary" onPress={closeSheet} style={{ flex: 1 }} />
              <Button
                label="Guardar"
                variant="primary"
                onPress={() => onConfirm(parseFloat(weight) || 0, parseInt(reps, 10) || 0)}
                style={{ flex: 1 }}
              />
            </View>
          </KeyboardAvoidingView>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

// ── Pantalla principal ───────────────────────────────────────────────────────

export function TrainingScreen() {
  const {
    todayWorkout, toggleExercise,
    fetchTodayTraining, logExerciseSet, completeSession,
    isLoadingTraining,
  } = usePlanStore();

  const [restTimer,     setRestTimer]     = useState<number | null>(null);
  const [timerRunning,  setTimerRunning]  = useState(false);
  const [setModal,      setSetModal]      = useState<{ exerciseId: string; name: string; weight?: number; reps?: number } | null>(null);
  const [completing,    setCompleting]    = useState(false);
  const pulseScale = useSharedValue(1);

  useEffect(() => { fetchTodayTraining(); }, []);

  const completedCount = todayWorkout.exercises.filter((e) => e.completed).length;
  const totalCount     = todayWorkout.exercises.length;
  const allDone        = completedCount === totalCount && totalCount > 0;
  const pct            = totalCount > 0 ? completedCount / totalCount : 0;

  const activeExerciseId = todayWorkout.exercises.find((e) => !e.completed)?.id ?? null;

  // Pulso en progreso avanzado (Reanimated)
  useEffect(() => {
    if (pct > 0.5) {
      pulseScale.value = withRepeat(
        withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,   // infinito
        true  // reverse
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
    }
  }, [pct > 0.5]);

  // Temporizador de descanso
  useEffect(() => {
    if (!timerRunning || restTimer === null) return;
    if (restTimer === 0) { setTimerRunning(false); return; }
    const t = setTimeout(() => setRestTimer((v) => (v ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [timerRunning, restTimer]);

  const handleExerciseToggle = (id: string) => {
    const ex = todayWorkout.exercises.find((e) => e.id === id);
    if (!ex) return;

    if (!ex.completed) {
      // Abrir modal para registrar la serie antes de completar
      setSetModal({ exerciseId: id, name: ex.name, weight: ex.weight, reps: ex.reps });
    } else {
      setTimerRunning(false);
      setRestTimer(null);
      toggleExercise(id);
    }
  };

  const handleSetConfirm = async (weight: number, reps: number) => {
    if (!setModal) return;
    const ex = todayWorkout.exercises.find((e) => e.id === setModal.exerciseId);
    setSetModal(null);

    try {
      await logExerciseSet(todayWorkout.id, setModal.exerciseId, { weight_kg: weight, reps });
    } catch {
      // Marcar localmente aunque falle la sincronización
      toggleExercise(setModal.exerciseId);
    }

    // Iniciar temporizador de descanso
    if (ex?.restSeconds) {
      setRestTimer(ex.restSeconds);
      setTimerRunning(true);
    }
  };

  const handleCompleteSession = async () => {
    setCompleting(true);
    // Haptic de éxito al completar sesión
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await completeSession(todayWorkout.id);
    } catch {
      // ignorar — ya está marcado localmente
    } finally {
      setCompleting(false);
    }
  };

  if (isLoadingTraining) return (
    <SafeAreaView style={styles.safe}><TrainingSkeleton /></SafeAreaView>
  );

  if (!todayWorkout.id || todayWorkout.exercises.length === 0) return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.empty}>
        <Text style={{ fontSize: 48 }}>🏖️</Text>
        <Text style={styles.emptyTitle}>Día de descanso</Text>
        <Text style={styles.emptySub}>No tienes sesión programada para hoy. Aprovecha para recuperarte.</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* WorkoutCard inProgress como cabecera */}
        <WorkoutCard
          variant="inProgress"
          title={todayWorkout.name}
          type={todayWorkout.muscleGroups[0] ?? 'Fuerza'}
          durationMin={todayWorkout.durationMinutes}
          progress={pct}
          completed={todayWorkout.completed}
          calsBurned={todayWorkout.estimatedCalories ? String(todayWorkout.estimatedCalories) : undefined}
          accessibilityLabel={`Entrenamiento: ${todayWorkout.name}`}
        />

        {/* Chips de grupos musculares */}
        <View style={styles.metaRow}>
          {todayWorkout.muscleGroups.map((g) => (
            <View key={g} style={styles.chip}>
              <Text style={styles.chipText}>{g}</Text>
            </View>
          ))}
        </View>

        {/* Anillo de progreso */}
        <Reanimated.View style={[styles.ringWrapper, useAnimatedStyle(() => ({ transform: [{ scale: pulseScale.value }] }))]}>
          <DailyProgressRing progress={pct} label="Sesión de hoy" size={160} />
        </Reanimated.View>

        {/* Temporizador de descanso */}
        {timerRunning && restTimer !== null && restTimer > 0 && (
          <RestTimer
            totalSeconds={restTimer ?? 90}
            remaining={restTimer ?? 0}
            onComplete={() => { setTimerRunning(false); setRestTimer(null); }}
          />
        )}

        {/* Ejercicios agrupados por músculo */}
        {todayWorkout.muscleGroups.map((group) => {
          const exs = todayWorkout.exercises.filter((e) => e.muscleGroup === group);
          if (exs.length === 0) return null;
          return (
            <View key={group}>
              <Text style={styles.groupTitle}>{group}</Text>
              {exs.map((e) => (
                <ExerciseRow
                  key={e.id}
                  name={e.name}
                  detail={`${e.sets} × ${e.reps} reps${e.weight ? ` · ${e.weight} kg` : ''}`}
                  completed={e.completed}
                  active={activeExerciseId === e.id}
                  onToggle={() => handleExerciseToggle(e.id)}
                />
              ))}
            </View>
          );
        })}

        {/* Resumen al finalizar */}
        {allDone && (
          <WorkoutSummary
            duration={todayWorkout.durationMinutes}
            calories={todayWorkout.estimatedCalories ?? 0}
            exercises={totalCount}
            sets={todayWorkout.exercises.reduce((acc, e) => acc + (e.sets ?? 1), 0)}
            workoutName={todayWorkout.name}
          />
        )}

        {/* CTA finalizar sesión */}
        <Button
          label={
            todayWorkout.completed
              ? '✓ Sesión completada'
              : allDone
                ? 'Terminar sesión'
                : `Completando… (${completedCount}/${totalCount})`
          }
          variant={todayWorkout.completed ? 'secondary' : 'primary'}
          disabled={!allDone || todayWorkout.completed}
          loading={completing}
          onPress={handleCompleteSession}
          style={styles.cta}
        />

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* Bottom sheet de registro de serie */}
      {setModal && (
        <SetSheet
          exerciseName={setModal.name}
          defaultWeight={setModal.weight}
          defaultReps={setModal.reps}
          onConfirm={handleSetConfirm}
          onClose={() => setSetModal(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.offWhite },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    backgroundColor: colors.neutral.lightGray, borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  chipText: { ...textStyles.caption, color: colors.neutral.darkGray, fontWeight: '600' },
  ringWrapper: { alignItems: 'center', marginBottom: spacing.lg },
  groupTitle: { ...textStyles.label, color: colors.neutral.midGray, marginTop: spacing.lg, marginBottom: spacing.sm },
  cta: { marginTop: spacing.lg },

  // Empty state
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  emptyTitle: { ...textStyles.titleMedium, color: colors.neutral.black, textAlign: 'center' },
  emptySub:   { ...textStyles.bodyNormal,  color: colors.neutral.midGray, textAlign: 'center', lineHeight: 22 },
});

const sheet = StyleSheet.create({
  // Capa que cubre toda la pantalla (overlay + sheet)
  container: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0 },
  backdrop:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.xl, paddingTop: spacing.md,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: colors.neutral.lightGray,
    marginBottom: spacing.md,
  },
});

const modal = StyleSheet.create({
  title:    { ...textStyles.titleSmall, color: colors.neutral.black },
  subtitle: { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginTop: -spacing.md },
  row:      { flexDirection: 'row', gap: spacing.md },
  field:    { flex: 1, gap: spacing.xs },
  fieldLabel:{ ...textStyles.caption, color: colors.neutral.midGray, fontWeight: '600' },
  input:    { height: 52, borderRadius: borderRadius.input, borderWidth: 1.5, borderColor: colors.neutral.lightGray, paddingHorizontal: spacing.md, ...textStyles.titleSmall, color: colors.neutral.black, textAlign: 'center', ...shadows.card },
  btns:     { flexDirection: 'row', gap: spacing.md },
});

export default TrainingScreen;
