/**
 * MetricCard — tarjeta de métrica estilo Whoop
 * Exporta: MetricCard, RecoveryScore, MetricGrid, Sparkline
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { colors }                        from '@/theme/colors';
import { borderRadius, spacing } from '@/theme/spacing';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface MetricCardProps {
  label?:       string;
  value?:       string;
  unit?:        string;
  trend?:       number;
  trendLabel?:  string;
  accentColor?: string;
  icon?:        string;
  sparkData?:   number[];
  subtext?:     string;
  onPress?:     () => void;
  style?:       ViewStyle;
}

interface RecoveryScoreProps {
  score?:      number; // 0–100
  message?:    string;
  hrv?:        number;
  restingHr?:  number;
}

interface MetricItem extends MetricCardProps {}

interface MetricGridProps {
  metrics?: MetricItem[];
  style?:   ViewStyle;
}

interface SparklineProps {
  data?:   number[];
  color?:  string;
  height?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexAlpha(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  } catch {
    return hex;
  }
}

// ── MetricCard ────────────────────────────────────────────────────────────────

export function MetricCard({
  label       = '',
  value       = '—',
  unit        = '',
  trend,
  trendLabel  = 'vs ayer',
  accentColor = colors.whoop.recovery,
  icon,
  sparkData,
  subtext,
  onPress,
  style,
}: MetricCardProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const timingConfig = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

  const handlePressIn  = () => { scale.value = withTiming(0.97, timingConfig); };
  const handlePressOut = () => { scale.value = withTiming(1,    timingConfig); };

  const hasTrend    = trend !== undefined && trend !== null;
  const trendUp     = hasTrend && trend! >= 0;
  const trendColor  = trendUp ? colors.whoop.recovery : colors.whoop.recoveryLow;
  const trendSymbol = trendUp ? '↑' : '↓';

  const content = (
    <View style={styles.inner}>
      {/* Header: label + icono */}
      <View style={styles.header}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        {icon && (
          <View style={[styles.iconBadge, { backgroundColor: hexAlpha(accentColor, 0.15) }]}>
            <Text style={[styles.iconText, { color: accentColor }]}>{icon}</Text>
          </View>
        )}
      </View>

      {/* Valor principal */}
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={[styles.unit, { color: accentColor }]}>{unit}</Text> : null}
      </View>

      {/* Subtext opcional */}
      {subtext ? <Text style={styles.subtext}>{subtext}</Text> : null}

      {/* Trend */}
      {hasTrend && (
        <View style={styles.trendRow}>
          <Text style={[styles.trendSymbol, { color: trendColor }]}>{trendSymbol}</Text>
          <Text style={[styles.trendValue,  { color: trendColor }]}>{Math.abs(trend!)}</Text>
          <Text style={styles.trendLabel}> {trendLabel}</Text>
        </View>
      )}

      {/* Sparkline */}
      {sparkData && sparkData.length > 0 && (
        <Sparkline data={sparkData} color={accentColor} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <ReAnimated.View style={[animatedStyle, style]}>
        <Pressable
          style={styles.card}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value}${unit}`}
        >
          {content}
        </Pressable>
      </ReAnimated.View>
    );
  }

  return <View style={[styles.card, style]}>{content}</View>;
}

// ── RecoveryScore ─────────────────────────────────────────────────────────────

export function RecoveryScore({ score = 0, message, hrv, restingHr }: RecoveryScoreProps) {
  const accentColor =
    score >= 67
      ? colors.whoop.recovery
      : score >= 34
        ? colors.whoop.recoveryMid
        : colors.whoop.recoveryLow;

  return (
    <View style={[styles.recoveryCard, { borderColor: hexAlpha(accentColor, 0.30) }]}>
      <Text style={styles.recoveryLabel}>RECUPERACIÓN</Text>

      {/* Score — mostramos valor final directo */}
      <Text style={[styles.recoveryScore, { color: accentColor }]}>{score}%</Text>

      {message && <Text style={styles.recoveryMsg}>{message}</Text>}

      {(hrv || restingHr) && (
        <View style={styles.recoveryMeta}>
          {hrv ? (
            <View style={styles.recoveryMetaItem}>
              <Text style={styles.recoveryMetaVal}>{hrv} ms</Text>
              <Text style={styles.recoveryMetaLabel}>HRV</Text>
            </View>
          ) : null}
          {hrv && restingHr ? <View style={styles.recoveryDivider} /> : null}
          {restingHr ? (
            <View style={styles.recoveryMetaItem}>
              <Text style={styles.recoveryMetaVal}>{restingHr} bpm</Text>
              <Text style={styles.recoveryMetaLabel}>FC REPOSO</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── MetricGrid ────────────────────────────────────────────────────────────────

export function MetricGrid({ metrics = [], style }: MetricGridProps) {
  return (
    <View style={[gridStyles.grid, style]}>
      {metrics.map((m, i) => (
        <View key={i} style={gridStyles.cell}>
          <MetricCard {...m} />
        </View>
      ))}
    </View>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

export function Sparkline({ data = [], color = colors.primary.green, height = 32 }: SparklineProps) {
  const MAX_BARS = 14;
  const bars     = data.slice(-MAX_BARS);

  return (
    <View style={[sparkStyles.container, { height }]}>
      {bars.map((val, i) => (
        <View
          key={i}
          style={[
            sparkStyles.bar,
            {
              height:          `${Math.max(4, Math.round(val * 100))}%` as any,
              backgroundColor: hexAlpha(color, 0.20 + val * 0.65),
              borderRadius:    2,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.whoop.card,
    borderRadius:    borderRadius.card,
    borderWidth:     1,
    borderColor:     colors.whoop.cardBorder,
    marginBottom:    12,
    overflow:        'hidden',
  },

  inner: {
    padding: 18,
  },

  header: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginBottom:   10,
  },

  label: {
    fontSize:      10,
    fontWeight:    '600',
    color:         colors.whoop.textLabel,
    letterSpacing: 1.2,
  },

  iconBadge: {
    width:          28,
    height:         28,
    borderRadius:   8,
    alignItems:     'center',
    justifyContent: 'center',
  },

  iconText: {
    fontSize: 14,
  },

  valueRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    marginBottom:  4,
  },

  value: {
    fontSize:      40,
    fontWeight:    '700',
    color:         colors.whoop.textVal,
    letterSpacing: -1.5,
    lineHeight:    44,
  },

  unit: {
    fontSize:     16,
    fontWeight:   '600',
    marginLeft:   4,
    marginBottom: 6,
  },

  subtext: {
    fontSize:     12,
    color:        colors.whoop.textLabel,
    marginBottom: 8,
  },

  trendRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     6,
  },

  trendSymbol: {
    fontSize:    13,
    fontWeight:  '700',
    marginRight: 2,
  },

  trendValue: {
    fontSize:   13,
    fontWeight: '600',
  },

  trendLabel: {
    fontSize: 12,
    color:    colors.whoop.textLabel,
  },

  // Recovery card
  recoveryCard: {
    backgroundColor: colors.whoop.card,
    borderRadius:    borderRadius.card,
    borderWidth:     1.5,
    padding:         24,
    marginBottom:    12,
    alignItems:      'center',
  },

  recoveryLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         colors.whoop.textLabel,
    letterSpacing: 1.4,
    marginBottom:  12,
  },

  recoveryScore: {
    fontSize:      72,
    fontWeight:    '800',
    letterSpacing: -3,
    lineHeight:    76,
  },

  recoveryMsg: {
    fontSize:   14,
    fontWeight: '500',
    color:      colors.whoop.textVal,
    opacity:    0.75,
    marginTop:  8,
    textAlign:  'center',
  },

  recoveryMeta: {
    flexDirection:  'row',
    alignItems:     'center',
    marginTop:      20,
    width:          '100%',
    justifyContent: 'center',
  },

  recoveryMetaItem: {
    alignItems: 'center',
    flex:        1,
  },

  recoveryMetaVal: {
    fontSize:      18,
    fontWeight:    '700',
    color:         colors.whoop.textVal,
    letterSpacing: -0.5,
  },

  recoveryMetaLabel: {
    fontSize:      10,
    fontWeight:    '600',
    color:         colors.whoop.textLabel,
    letterSpacing: 1.2,
    marginTop:     3,
  },

  recoveryDivider: {
    width:            1,
    height:           32,
    backgroundColor:  colors.whoop.graphLine,
    marginHorizontal: 12,
  },
});

const gridStyles = StyleSheet.create({
  grid: {
    flexDirection:    'row',
    flexWrap:         'wrap',
    marginHorizontal: -6,
  },

  cell: {
    width:             '50%',
    paddingHorizontal: 6,
  },
});

const sparkStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    marginTop:     12,
    gap:           3,
  },

  bar: {
    flex:      1,
    minHeight: 4,
  },
});

export default MetricCard;
