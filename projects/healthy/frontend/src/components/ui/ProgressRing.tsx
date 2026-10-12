/**
 * ProgressRing — anillo de progreso estilo Apple Watch / Fitness+
 *
 * Requiere: react-native-svg (con fallback si no está disponible)
 * Exporta: ProgressRing, ActivityRings, DailyProgressRing
 */

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ReAnimated, {
  useSharedValue, useAnimatedProps, withSpring, FadeIn,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

// ── Carga dinámica de react-native-svg con fallback ───────────────────────────

let Svg: any,
  Circle: any,
  Defs: any,
  LinearGradient: any,
  Stop: any,
  AnimatedCircle: any;

try {
  const rnsvg     = require('react-native-svg');
  Svg             = rnsvg.Svg;
  Circle          = rnsvg.Circle;
  Defs            = rnsvg.Defs;
  LinearGradient  = rnsvg.LinearGradient;
  Stop            = rnsvg.Stop;
  AnimatedCircle  = ReAnimated.createAnimatedComponent(Circle);
} catch (_) {
  // fallback: solo se muestra el contenido interior
}

const SVG_OK = !!Svg;

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ProgressRingProps {
  progress?:    number;       // 0–1
  size?:        number;
  stroke?:      number;
  color?:       string;
  trackColor?:  string;
  children?:    React.ReactNode;
  animate?:     boolean;
  gradientEnd?: string;
  /** Índice opcional para stagger FadeIn al montar (AD-6d) */
  index?:       number;
}

interface ActivityRingsProps {
  move?:     number; // 0–1 calorías
  exercise?: number; // 0–1 minutos de ejercicio
  stand?:    number; // 0–1 horas de pie
  size?:     number;
}

interface DailyProgressRingProps {
  progress?: number; // 0–1
  size?:     number;
  label?:    string;
  darkMode?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return hex;
  }
}

function lighten(hex: string): string {
  // Versión más clara para el gradiente
  try {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + 40);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + 40);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + 40);
    return `rgb(${r},${g},${b})`;
  } catch {
    return hex;
  }
}

// ── ProgressRing ──────────────────────────────────────────────────────────────

export function ProgressRing({
  progress    = 0,
  size        = 120,
  stroke      = 12,
  color       = colors.primary.green,
  trackColor,
  children,
  animate     = true,
  gradientEnd,
  index,
}: ProgressRingProps) {
  const clampedProgress = Math.min(1, Math.max(0, progress));

  const r       = (size - stroke) / 2;
  const cx      = size / 2;
  const cy      = size / 2;
  const circumf = 2 * Math.PI * r;
  const track   = trackColor ?? hexWithAlpha(color, 0.12);
  const gradEnd = gradientEnd ?? lighten(color);

  // Compartir valor: empieza "vacío" (circumf) y anima hasta circumf*(1-progress)
  const offset = useSharedValue(circumf);

  useEffect(() => {
    const target = circumf - circumf * clampedProgress;
    if (animate) {
      offset.value = withSpring(target, { duration: 900, dampingRatio: 1 });
    } else {
      offset.value = target;
    }
  }, [clampedProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  // FadeIn stagger — builder construido en useMemo para evitar recreación en cada render
  const entering = useMemo(
    () => index !== undefined ? FadeIn.duration(400).delay(index * 80) : undefined,
    [index],
  );

  if (!SVG_OK) {
    return (
      <ReAnimated.View entering={entering} style={[styles.container, { width: size, height: size }]}>
        <View
          style={[
            styles.fallbackRing,
            { width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: track },
          ]}
        />
        <View style={styles.inner}>{children}</View>
      </ReAnimated.View>
    );
  }

  return (
    <ReAnimated.View entering={entering} style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`grad-${color}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%"   stopColor={color}   stopOpacity="1" />
            <Stop offset="100%" stopColor={gradEnd} stopOpacity="0.85" />
          </LinearGradient>
        </Defs>

        {/* Pista de fondo */}
        <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={stroke} fill="none" />

        {/* Arco de progreso animado con Reanimated useAnimatedProps */}
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={r}
          stroke={`url(#grad-${color})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumf}
          animatedProps={animatedProps}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx},${cy}`}
        />
      </Svg>

      <View style={styles.inner}>{children}</View>
    </ReAnimated.View>
  );
}

// ── ActivityRings ─────────────────────────────────────────────────────────────

export function ActivityRings({ move = 0, exercise = 0, stand = 0, size = 140 }: ActivityRingsProps) {
  const GAP    = 10;
  const STROKE = 10;

  return (
    <View style={{ width: size, height: size }}>
      <ProgressRing size={size} stroke={STROKE} progress={move} color="#EF4444" gradientEnd="#F97316" />
      <View style={[StyleSheet.absoluteFill, { padding: STROKE + GAP }]}>
        <ProgressRing
          size={size - (STROKE + GAP) * 2}
          stroke={STROKE}
          progress={exercise}
          color="#22C55E"
          gradientEnd="#84CC16"
        />
        <View style={[StyleSheet.absoluteFill, { padding: STROKE + GAP }]}>
          <ProgressRing
            size={size - (STROKE + GAP) * 4}
            stroke={STROKE}
            progress={stand}
            color="#3B82F6"
            gradientEnd="#06B6D4"
          />
        </View>
      </View>
    </View>
  );
}

// ── DailyProgressRing ─────────────────────────────────────────────────────────

export function DailyProgressRing({
  progress = 0,
  size     = 180,
  label    = 'Objetivo diario',
  darkMode = false,
}: DailyProgressRingProps) {
  const pct = Math.round(progress * 100);

  return (
    <ProgressRing progress={progress} size={size} stroke={14} color={colors.primary.green}>
      <View style={styles.dailyInner}>
        <Text style={[styles.dailyPct, darkMode && styles.dailyPctDark]}>{pct}%</Text>
        <Text style={styles.dailyLabel}>{label}</Text>
      </View>
    </ProgressRing>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems:     'center',
    justifyContent: 'center',
  },

  inner: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
  },

  fallbackRing: {
    position: 'absolute',
  },

  dailyInner: {
    alignItems: 'center',
  },

  dailyPct: {
    fontSize:      36,
    fontWeight:    '700',
    color:         colors.neutral.darkGray,
    letterSpacing: -1,
  },

  dailyPctDark: {
    color: colors.dark.textPrimary,
  },

  dailyLabel: {
    fontSize:       12,
    fontWeight:     '500',
    color:          colors.neutral.midGray,
    marginTop:      2,
    textTransform:  'uppercase',
    letterSpacing:  0.5,
  },
});

export default ProgressRing;
