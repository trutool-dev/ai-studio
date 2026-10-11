/**
 * WorkoutCard — tarjeta de entrenamiento estilo Apple Fitness+
 * Exporta: WorkoutCard, ExerciseRow, RestTimer, WorkoutSummary
 */

import React, { useRef } from 'react';
import {
  Animated,
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors }                                      from '@/theme/colors';
import { borderRadius, shadows, spacing } from '@/theme/spacing';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type WorkoutVariant = 'featured' | 'compact' | 'inProgress';

interface WorkoutCardProps {
  title?:       string;
  type?:        string;
  durationMin?: number;
  trainer?:     string;
  imageSource?: ImageSourcePropType;
  variant?:     WorkoutVariant;
  progress?:    number; // 0–1 si está en progreso
  completed?:   boolean;
  calsBurned?:  string;
  onPress?:     () => void;
  style?:       ViewStyle;
}

interface ExerciseRowProps {
  name?:      string;
  detail?:    string;
  completed?: boolean;
  active?:    boolean;
  onToggle?:  () => void;
}

interface RestTimerProps {
  totalSeconds?: number;
  remaining?:    number;
  onComplete?:   () => void;
}

interface WorkoutSummaryProps {
  duration?:    number;
  calories?:    number;
  exercises?:   number;
  sets?:        number;
  workoutName?: string;
}

// ── WorkoutCard ───────────────────────────────────────────────────────────────

export function WorkoutCard({
  title       = 'Entrenamiento',
  type        = 'Fuerza',
  durationMin = 45,
  trainer,
  imageSource,
  variant     = 'featured',
  progress,
  completed   = false,
  calsBurned,
  onPress,
  style,
}: WorkoutCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const timingConfig = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

  const handlePressIn  = () => { scale.value = withTiming(0.97, timingConfig); };
  const handlePressOut = () => { scale.value = withTiming(1,    timingConfig); };

  const isCompact    = variant === 'compact';
  const isInProgress = variant === 'inProgress';
  const cardH        = isCompact ? 100 : isInProgress ? 160 : 220;

  const inner = (
    <View style={[styles.card, { height: cardH }, style]}>
      {/* Imagen de fondo */}
      {imageSource ? (
        <ImageBackground
          source={imageSource}
          style={StyleSheet.absoluteFill}
          imageStyle={{ borderRadius: borderRadius.card }}
        >
          <View style={styles.overlay} />
        </ImageBackground>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.placeholderBg]} />
      )}

      {/* Badge de tipo */}
      <View style={styles.typeBadge}>
        <Text style={styles.typeText}>{type.toUpperCase()}</Text>
      </View>

      {/* Badge completado */}
      {completed && (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>✓</Text>
        </View>
      )}

      {/* Contenido inferior */}
      <View style={[styles.bottom, isCompact && styles.bottomCompact]}>
        <Text style={[styles.title, isCompact && styles.titleCompact]} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.metaDuration}>{durationMin} min</Text>

          {trainer && !isCompact && (
            <>
              <Text style={styles.metaDot}> · </Text>
              <Text style={styles.metaTrainer}>{trainer}</Text>
            </>
          )}

          {calsBurned && (
            <>
              <Text style={styles.metaDot}> · </Text>
              <Text style={[styles.metaTrainer, { color: colors.semantic.warning }]}>
                {calsBurned} kcal
              </Text>
            </>
          )}
        </View>

        {/* Barra de progreso en sesión activa */}
        {isInProgress && progress !== undefined && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` as any }]} />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <ReAnimated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${type}, ${durationMin} minutos`}
      >
        {inner}
      </Pressable>
    </ReAnimated.View>
  );
}

// ── ExerciseRow ───────────────────────────────────────────────────────────────

export function ExerciseRow({
  name      = '',
  detail    = '',
  completed = false,
  active    = false,
  onToggle,
}: ExerciseRowProps) {
  const checkAnim = useRef(new Animated.Value(completed ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    const next = !completed;

    // Haptic al marcar como completado
    if (next) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    Animated.parallel([
      Animated.timing(checkAnim, {
        toValue:  next ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 0.92, duration: 80,  useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      ]),
    ]).start();

    onToggle?.();
  };

  const checkBg = checkAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(34,197,94,0)', colors.primary.green],
  });

  const checkOpacity = checkAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View
      style={[exStyles.row, active && exStyles.rowActive, { transform: [{ scale: scaleAnim }] }]}
    >
      {/* Check circle */}
      <Pressable onPress={handlePress} style={exStyles.checkWrap} accessibilityRole="checkbox">
        <Animated.View
          style={[
            exStyles.check,
            {
              backgroundColor: checkBg,
              borderColor: completed ? colors.primary.green : colors.neutral.lightGray,
            },
          ]}
        >
          <Animated.Text style={[exStyles.checkMark, { opacity: checkOpacity }]}>✓</Animated.Text>
        </Animated.View>
      </Pressable>

      {/* Info */}
      <View style={exStyles.info}>
        <Text style={[exStyles.name, completed && exStyles.nameCompleted]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={exStyles.detail}>{detail}</Text>
      </View>

      {/* Indicador activo */}
      {active && <View style={exStyles.activeDot} />}
    </Animated.View>
  );
}

// ── RestTimer ─────────────────────────────────────────────────────────────────

export function RestTimer({ totalSeconds = 90, remaining = 90, onComplete }: RestTimerProps) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={timerStyles.container}>
      <View style={timerStyles.ring}>
        {/* Pista circular */}
        <View style={[timerStyles.ringTrack, { borderColor: colors.dark.border }]} />

        {/* Contenido interior */}
        <View style={timerStyles.ringInner}>
          <Text style={timerStyles.label}>DESCANSO</Text>
          <Text style={timerStyles.time}>
            {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${secs}s`}
          </Text>
          <Pressable
            onPress={onComplete}
            style={timerStyles.skipBtn}
            accessibilityLabel="Saltar descanso"
          >
            <Text style={timerStyles.skipText}>Saltar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── WorkoutSummary ────────────────────────────────────────────────────────────

export function WorkoutSummary({
  duration    = 0,
  calories    = 0,
  exercises   = 0,
  sets        = 0,
  workoutName,
}: WorkoutSummaryProps) {
  const stats = [
    { label: 'DURACIÓN',   value: `${duration}`,  unit: 'min'  },
    { label: 'CALORÍAS',   value: `${calories}`,   unit: 'kcal' },
    { label: 'EJERCICIOS', value: `${exercises}`,  unit: ''     },
    { label: 'SERIES',     value: `${sets}`,        unit: ''     },
  ];

  return (
    <View style={summaryStyles.card}>
      <Text style={summaryStyles.congrats}>¡Sesión completada!</Text>
      {workoutName && <Text style={summaryStyles.name}>{workoutName}</Text>}

      <View style={summaryStyles.statsGrid}>
        {stats.map((s, i) => (
          <View key={i} style={summaryStyles.stat}>
            <Text style={summaryStyles.statVal}>{s.value}</Text>
            {s.unit ? <Text style={summaryStyles.statUnit}>{s.unit}</Text> : null}
            <Text style={summaryStyles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Estilos WorkoutCard ───────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius:   borderRadius.card,
    overflow:       'hidden',
    marginBottom:   12,
    justifyContent: 'flex-end',
    ...shadows.card,
  },

  placeholderBg: {
    backgroundColor: '#1C2A1E',
    borderRadius:    borderRadius.card,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  typeBadge: {
    position:          'absolute',
    top:               spacing.md,
    left:              spacing.md,
    backgroundColor:   'rgba(0,0,0,0.45)',
    borderRadius:      borderRadius.pill,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.20)',
  },

  typeText: {
    fontSize:      10,
    fontWeight:    '700',
    color:         '#FFFFFF',
    letterSpacing: 1.2,
  },

  completedBadge: {
    position:        'absolute',
    top:             spacing.md,
    right:           spacing.md,
    width:           28,
    height:          28,
    borderRadius:    14,
    backgroundColor: colors.primary.green,
    alignItems:      'center',
    justifyContent:  'center',
  },

  completedText: {
    fontSize:   13,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  bottom: {
    padding: spacing.md,
  },

  bottomCompact: {
    padding:     spacing.sm,
    paddingLeft: spacing.md,
  },

  title: {
    fontSize:      20,
    fontWeight:    '700',
    color:         '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight:    24,
    marginBottom:  4,
  },

  titleCompact: {
    fontSize:   15,
    lineHeight: 18,
  },

  meta: {
    flexDirection: 'row',
    alignItems:    'center',
  },

  metaDuration: {
    fontSize:   13,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.75)',
  },

  metaDot: {
    fontSize: 13,
    color:    'rgba(255,255,255,0.40)',
  },

  metaTrainer: {
    fontSize: 13,
    color:    'rgba(255,255,255,0.60)',
  },

  progressTrack: {
    height:          3,
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius:    2,
    marginTop:       12,
    overflow:        'hidden',
  },

  progressFill: {
    height:          '100%',
    backgroundColor: colors.primary.green,
    borderRadius:    2,
  },
});

// ── Estilos ExerciseRow ───────────────────────────────────────────────────────

const exStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   14,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral.lightGray,
  },

  rowActive: {
    backgroundColor: colors.primary.lightGreen,
  },

  checkWrap: {
    marginRight: spacing.md,
  },

  check: {
    width:          28,
    height:         28,
    borderRadius:   14,
    borderWidth:    2,
    alignItems:     'center',
    justifyContent: 'center',
  },

  checkMark: {
    fontSize:   14,
    fontWeight: '700',
    color:      '#FFFFFF',
  },

  info: {
    flex: 1,
  },

  name: {
    fontSize:     15,
    fontWeight:   '600',
    color:        colors.neutral.darkGray,
    marginBottom: 2,
  },

  nameCompleted: {
    opacity:            0.45,
    textDecorationLine: 'line-through',
  },

  detail: {
    fontSize: 13,
    color:    colors.neutral.midGray,
  },

  activeDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.primary.green,
    marginLeft:      spacing.sm,
  },
});

// ── Estilos RestTimer ─────────────────────────────────────────────────────────

const timerStyles = StyleSheet.create({
  container: {
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing.xl,
  },

  ring: {
    width:          160,
    height:         160,
    alignItems:     'center',
    justifyContent: 'center',
  },

  ringTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 80,
    borderWidth:  8,
  },

  ringInner: {
    alignItems: 'center',
  },

  label: {
    fontSize:      10,
    fontWeight:    '600',
    color:         colors.neutral.midGray,
    letterSpacing: 1.4,
    marginBottom:  4,
  },

  time: {
    fontSize:      48,
    fontWeight:    '700',
    color:         colors.neutral.darkGray,
    letterSpacing: -2,
  },

  skipBtn: {
    marginTop:         12,
    paddingVertical:   6,
    paddingHorizontal: 16,
    borderRadius:      borderRadius.pill,
    borderWidth:       1,
    borderColor:       colors.primary.green,
  },

  skipText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.primary.green,
  },
});

// ── Estilos WorkoutSummary ────────────────────────────────────────────────────

const summaryStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius:    borderRadius.card,
    padding:         spacing.xl,
    alignItems:      'center',
    ...shadows.modal,
  },

  congrats: {
    fontSize:      24,
    fontWeight:    '700',
    color:         colors.primary.green,
    letterSpacing: -0.5,
    marginBottom:  4,
  },

  name: {
    fontSize:     16,
    color:        colors.neutral.midGray,
    marginBottom: spacing.xl,
  },

  statsGrid: {
    flexDirection:  'row',
    width:          '100%',
    justifyContent: 'space-around',
  },

  stat: {
    alignItems: 'center',
  },

  statVal: {
    fontSize:      28,
    fontWeight:    '700',
    color:         colors.neutral.darkGray,
    letterSpacing: -1,
  },

  statUnit: {
    fontSize:  12,
    color:     colors.neutral.midGray,
    marginTop: -2,
  },

  statLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         colors.neutral.midGray,
    letterSpacing: 1.0,
    marginTop:     6,
  },
});

export default WorkoutCard;
