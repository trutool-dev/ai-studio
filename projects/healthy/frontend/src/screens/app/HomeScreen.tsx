/**
 * HomeScreen — resumen del día: plan activo, calorías, entrenamiento y log diario.
 * FE-07: GET/PUT /logs/today conectado al DailyLogWidget.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated, ScrollView, StyleSheet, Text, View,
  SafeAreaView, Pressable,
} from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { usePlanStore, calcDayTotals } from '@/stores/planStore';
import { useAuthStore }                from '@/stores/authStore';
import { MacroCard }                   from '@/components/ui/MacroCard';
import { DailyLogWidget }              from '@/components/ui/DailyLogWidget';
import { colors }                      from '@/theme/colors';
import { textStyles }                  from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

// ── Skeleton ─────────────────────────────────────────────────────────────────

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

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function HomeScreen() {
  const {
    todayWorkout, todayMeals, targets, log, streak,
    logWater, fetchTodayTraining, fetchTodayNutrition, fetchTodayLog, submitLog,
    isLoadingTraining, isLoadingNutrition, isLoadingLog,
  } = usePlanStore();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchTodayTraining();
    fetchTodayNutrition();
    fetchTodayLog();
  }, []);

  const totals      = calcDayTotals(todayMeals);
  const calPct      = Math.min(totals.calories / targets.calories, 1);
  const completedEx = todayWorkout.exercises.filter((e) => e.completed).length;
  const totalEx     = todayWorkout.exercises.length;

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
  const firstName = user?.name?.split(' ')[0] ?? 'campeón';

  // Press feedback para la tarjeta de entrenamiento
  const workoutScale = useSharedValue(1);
  const workoutAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: workoutScale.value }] }));
  const workoutTimingConfig = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

  const handleAddWater = async () => {
    logWater(250);
    try {
      await submitLog({ waterMl: log.waterMl + 250 });
    } catch {
      // fallback silencioso — la actualización local ya se hizo
    }
  };

  const isLoading = isLoadingTraining && isLoadingNutrition;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Cabecera */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName} 👋</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakCount}>{streak}</Text>
          </View>
        </View>

        {/* Skeleton mientras carga */}
        {isLoading ? (
          <>
            <SkeletonBlock height={100} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <SkeletonBlock height={80} style={{ flex: 1 }} />
              <SkeletonBlock height={80} style={{ flex: 1 }} />
              <SkeletonBlock height={80} style={{ flex: 1 }} />
            </View>
            <SkeletonBlock height={72} />
            <SkeletonBlock height={100} />
          </>
        ) : (
          <>
            {/* Anillo de calorías */}
            <View style={styles.calCard}>
              <View style={styles.calRing}>
                <CalRing pct={calPct} />
                <View style={styles.calCenter}>
                  <Text style={styles.calValue}>{Math.round(totals.calories)}</Text>
                  <Text style={styles.calLabel}>kcal</Text>
                </View>
              </View>
              <View style={styles.calInfo}>
                <Text style={styles.calTitle}>Calorías de hoy</Text>
                <Text style={styles.calSub}>Objetivo: {targets.calories} kcal</Text>
                <Text style={styles.calRemain}>
                  Restantes:{' '}
                  <Text style={{ color: colors.primary.darkGreen, fontWeight: '700' }}>
                    {Math.max(targets.calories - Math.round(totals.calories), 0)} kcal
                  </Text>
                </Text>
              </View>
            </View>

            {/* Macros */}
            <View style={styles.macroRow}>
              <MacroCard label="Proteína" current={totals.protein} target={targets.protein} color={colors.semantic.info}    />
              <MacroCard label="Carbos"   current={totals.carbs}   target={targets.carbs}   color={colors.semantic.warning} />
              <MacroCard label="Grasa"    current={totals.fat}     target={targets.fat}     color={colors.semantic.error}   />
            </View>

            {/* Entrenamiento del día */}
            <SectionTitle title="Entrenamiento de hoy" />
            <ReAnimated.View style={workoutAnimStyle}>
            <Pressable
              style={styles.workoutCard}
              accessibilityLabel={`Entrenamiento: ${todayWorkout.name}`}
              accessibilityRole="button"
              onPressIn={() => { workoutScale.value = withTiming(0.98, workoutTimingConfig); }}
              onPressOut={() => { workoutScale.value = withTiming(1, workoutTimingConfig); }}
            >
              <View style={styles.workoutLeft}>
                <Text style={styles.workoutIcon}>🏋️</Text>
                <View>
                  <Text style={styles.workoutName}>{todayWorkout.name}</Text>
                  <Text style={styles.workoutMeta}>
                    {todayWorkout.durationMinutes} min · {todayWorkout.muscleGroups.join(', ')}
                  </Text>
                </View>
              </View>
              <View style={styles.workoutProgress}>
                <Text style={styles.workoutFraction}>{completedEx}/{totalEx}</Text>
                <Text style={styles.workoutFractionLabel}>ejercicios</Text>
              </View>
            </Pressable>
            </ReAnimated.View>

            {/* Barra de progreso del workout */}
            <View style={styles.workoutBar}>
              <View style={[styles.workoutFill, { width: `${totalEx > 0 ? (completedEx / totalEx) * 100 : 0}%` }]} />
            </View>

            {/* Comidas */}
            <SectionTitle title="Comidas" />
            <View style={styles.mealsRow}>
              {todayMeals.map((m) => (
                <View key={m.id} style={[styles.mealChip, m.completed && styles.mealChipDone]}>
                  <Text style={styles.mealChipIcon}>{m.icon}</Text>
                  <Text style={[styles.mealChipName, m.completed && styles.mealChipNameDone]}>{m.name}</Text>
                </View>
              ))}
            </View>

            {/* Registro diario */}
            <SectionTitle title="Registro del día" />
            <DailyLogWidget
              waterMl={log.waterMl}      waterTarget={targets.waterMl}
              steps={log.steps}          stepsTarget={targets.steps}
              sleepHours={log.sleepHours}
              onAddWater={handleAddWater}
            />
          </>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={sStyles.title}>{title}</Text>;
}

function CalRing({ pct }: { pct: number }) {
  const SIZE   = 90;
  const BORDER = 10;
  const filled = Math.round(pct * 360);

  return (
    <View style={{ width: SIZE, height: SIZE, position: 'relative' }}>
      <View style={{ position: 'absolute', inset: 0, borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: colors.neutral.lightGray }} />
      {filled > 0 && (
        <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: BORDER, borderColor: colors.primary.green, transform: [{ rotate: `-${Math.min(filled, 180)}deg` }] }} />
        </View>
      )}
    </View>
  );
}

const sStyles = StyleSheet.create({
  title: { ...textStyles.titleSmall, color: colors.neutral.black, marginTop: spacing.lg, marginBottom: spacing.sm },
});

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.offWhite },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  greeting:    { ...textStyles.titleSmall, color: colors.neutral.black },
  date:        { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginTop: 2 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: borderRadius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  streakFire:  { fontSize: 18 },
  streakCount: { ...textStyles.titleSmall, color: '#D97706' },

  calCard:  { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, padding: spacing.lg, ...shadows.card, marginBottom: spacing.sm },
  calRing:  { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  calCenter:{ position: 'absolute', alignItems: 'center' },
  calValue: { ...textStyles.titleSmall, color: colors.neutral.black },
  calLabel: { ...textStyles.caption, color: colors.neutral.midGray },
  calInfo:  { flex: 1 },
  calTitle: { ...textStyles.bodyLarge, fontWeight: '600', color: colors.neutral.black },
  calSub:   { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginTop: 2 },
  calRemain:{ ...textStyles.bodyNormal, color: colors.neutral.midGray, marginTop: spacing.xs },

  macroRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },

  workoutCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.neutral.white, borderRadius: borderRadius.card, padding: spacing.md, ...shadows.card },
  workoutLeft:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  workoutIcon:          { fontSize: 32 },
  workoutName:          { ...textStyles.bodyLarge, fontWeight: '600', color: colors.neutral.black },
  workoutMeta:          { ...textStyles.caption, color: colors.neutral.midGray, marginTop: 2 },
  workoutProgress:      { alignItems: 'center' },
  workoutFraction:      { ...textStyles.titleSmall, color: colors.primary.darkGreen },
  workoutFractionLabel: { ...textStyles.caption, color: colors.neutral.midGray },
  workoutBar:  { height: 4, backgroundColor: colors.neutral.lightGray, borderRadius: borderRadius.pill, overflow: 'hidden', marginTop: 6, marginBottom: spacing.sm },
  workoutFill: { height: '100%', backgroundColor: colors.primary.green, borderRadius: borderRadius.pill },

  mealsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mealChip:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.neutral.white, borderRadius: borderRadius.pill, borderWidth: 1.5, borderColor: colors.neutral.lightGray, ...shadows.card },
  mealChipDone: { borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  mealChipIcon: { fontSize: 16 },
  mealChipName:     { ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  mealChipNameDone: { color: colors.primary.darkGreen, fontWeight: '600' },
});

export default HomeScreen;
