/**
 * DailyLogWidget — widget de registro rápido: agua, pasos, sueño
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors }     from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

interface LogItemProps {
  icon:    string;
  label:   string;
  current: number;
  target:  number;
  unit:    string;
  color:   string;
  onAdd?:  () => void;
  addLabel?: string;
}

function LogItem({ icon, label, current, target, unit, color, onAdd, addLabel = '+' }: LogItemProps) {
  const pct = Math.min(current / target, 1);
  return (
    <View style={styles.item}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.info}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          <Text style={{ color, fontWeight: '700' }}>{current}</Text>
          <Text style={styles.target}> / {target} {unit}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
      </View>
      {onAdd && (
        <Pressable
          style={[styles.addBtn, { borderColor: color }]}
          onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          onPress={onAdd}
          accessibilityLabel={`Añadir ${label}`}
        >
          <Text style={[styles.addLabel, { color }]}>{addLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

interface DailyLogWidgetProps {
  waterMl:    number;
  waterTarget:number;
  steps:      number;
  stepsTarget:number;
  sleepHours: number;
  onAddWater?: () => void;
}

export function DailyLogWidget({ waterMl, waterTarget, steps, stepsTarget, sleepHours, onAddWater }: DailyLogWidgetProps) {
  const waterL = (waterMl / 1000).toFixed(1);
  const waterTargetL = (waterTarget / 1000).toFixed(1);

  return (
    <View style={styles.card}>
      <LogItem icon="💧" label="Agua"  current={+waterL} target={+waterTargetL} unit="L"  color={colors.semantic.info}    onAdd={onAddWater} addLabel="+250ml" />
      <View style={styles.divider} />
      <LogItem icon="👟" label="Pasos" current={steps}   target={stepsTarget}   unit="pa" color={colors.semantic.warning} />
      <View style={styles.divider} />
      <LogItem icon="😴" label="Sueño" current={sleepHours} target={8}          unit="h"  color="#A855F7" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius:    borderRadius.card,
    padding:         spacing.md,
    ...shadows.card,
  },
  item:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  icon:  { fontSize: 24, width: 32, textAlign: 'center' },
  info:  { flex: 1 },
  label: { ...textStyles.caption, color: colors.neutral.midGray, fontWeight: '600', marginBottom: 2 },
  value: { ...textStyles.bodyNormal },
  target:{ color: colors.neutral.midGray },
  track: { height: 4, borderRadius: borderRadius.pill, backgroundColor: colors.neutral.lightGray, overflow: 'hidden', marginTop: 4 },
  fill:  { height: '100%', borderRadius: borderRadius.pill },
  addBtn:{
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
    borderRadius:      borderRadius.pill,
    borderWidth:       1.5,
  },
  addLabel: { ...textStyles.caption, fontWeight: '700' },
  divider:  { height: 1, backgroundColor: colors.neutral.lightGray, marginVertical: 2 },
});
