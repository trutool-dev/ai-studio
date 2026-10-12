/**
 * DailyLogWidget — widget de registro rápido: agua, pasos, peso, sueño
 * A-10: modal con TextInput numérico al pulsar + en cada métrica
 */

import React, { useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors }     from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import api from '@/services/api';

// ── Modal de entrada numérica ────────────────────────────────────────────────

function InputModal({ visible, title, unit, onConfirm, onClose }: {
  visible: boolean; title: string; unit: string;
  onConfirm: (value: number) => void; onClose: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.card} onPress={() => {}}>
          <Text style={modalStyles.title}>{title}</Text>
          <TextInput
            style={modalStyles.input}
            keyboardType="numeric"
            value={text}
            onChangeText={setText}
            placeholder={`Valor en ${unit}`}
            placeholderTextColor={colors.neutral.midGray}
            autoFocus
          />
          <View style={modalStyles.row}>
            <Pressable style={modalStyles.btnCancel} onPress={() => { setText(''); onClose(); }}>
              <Text style={modalStyles.btnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={modalStyles.btnConfirm} onPress={() => {
              const n = parseFloat(text);
              if (!isNaN(n) && n > 0) { onConfirm(n); setText(''); onClose(); }
            }}>
              <Text style={modalStyles.btnConfirmText}>Guardar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── LogItem ──────────────────────────────────────────────────────────────────

interface LogItemProps {
  icon:    string;
  label:   string;
  current: number;
  target:  number;
  unit:    string;
  color:   string;
  onAdd?:  () => void;
}

function LogItem({ icon, label, current, target, unit, color, onAdd }: LogItemProps) {
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
          <Text style={[styles.addLabel, { color }]}>+</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Widget principal ─────────────────────────────────────────────────────────

interface DailyLogWidgetProps {
  waterMl:     number;
  waterTarget: number;
  steps:       number;
  stepsTarget: number;
  sleepHours:  number;
  weightKg?:   number;
  /** Llamado con los ml introducidos por el usuario */
  onAddWater?:  (ml: number) => void;
  /** Llamado con los pasos introducidos por el usuario */
  onAddSteps?:  (steps: number) => void;
  /** Llamado con el peso introducido por el usuario (también guarda en /progress) */
  onAddWeight?: (kg: number) => void;
  /** Llamado con las horas de sueño introducidas por el usuario */
  onAddSleep?:  (hours: number) => void;
}

export function DailyLogWidget({
  waterMl, waterTarget, steps, stepsTarget, sleepHours, weightKg,
  onAddWater, onAddSteps, onAddWeight, onAddSleep,
}: DailyLogWidgetProps) {
  const [activeModal, setActiveModal] = useState<'water' | 'steps' | 'weight' | 'sleep' | null>(null);

  const waterL       = (waterMl / 1000).toFixed(1);
  const waterTargetL = (waterTarget / 1000).toFixed(1);

  const handleConfirmWater = (value: number) => {
    onAddWater?.(value);
  };

  const handleConfirmSteps = (value: number) => {
    onAddSteps?.(Math.round(value));
  };

  const handleConfirmWeight = async (value: number) => {
    onAddWeight?.(value);
    try {
      await api.post('/progress', { weight_kg: value });
    } catch {
      // guardado en background; el valor local ya se actualizó
    }
  };

  const handleConfirmSleep = async (value: number) => {
    onAddSleep?.(value);
    try {
      await api.put('/logs/today', { sleep_hours: value });
    } catch {
      // guardado en background; el valor local ya se actualizó
    }
  };

  return (
    <View style={styles.card}>
      <LogItem
        icon="💧" label="Agua"
        current={+waterL} target={+waterTargetL} unit="L"
        color={colors.semantic.info}
        onAdd={onAddWater ? () => setActiveModal('water') : undefined}
      />
      <View style={styles.divider} />
      <LogItem
        icon="👟" label="Pasos"
        current={steps} target={stepsTarget} unit="pa"
        color={colors.semantic.warning}
        onAdd={onAddSteps ? () => setActiveModal('steps') : undefined}
      />
      <View style={styles.divider} />
      <LogItem
        icon="⚖️" label="Peso"
        current={weightKg ?? 0} target={weightKg ? weightKg + 10 : 100} unit="kg"
        color={colors.primary.green}
        onAdd={() => setActiveModal('weight')}
      />
      <View style={styles.divider} />
      <LogItem
        icon="😴" label="Sueño"
        current={sleepHours} target={8} unit="h"
        color="#A855F7"
        onAdd={() => setActiveModal('sleep')}
      />

      {/* Modales de entrada */}
      <InputModal
        visible={activeModal === 'water'}
        title="Añadir agua"
        unit="ml"
        onConfirm={handleConfirmWater}
        onClose={() => setActiveModal(null)}
      />
      <InputModal
        visible={activeModal === 'steps'}
        title="Registrar pasos"
        unit="pasos"
        onConfirm={handleConfirmSteps}
        onClose={() => setActiveModal(null)}
      />
      <InputModal
        visible={activeModal === 'weight'}
        title="Registrar peso"
        unit="kg"
        onConfirm={handleConfirmWeight}
        onClose={() => setActiveModal(null)}
      />
      <InputModal
        visible={activeModal === 'sleep'}
        title="Horas de sueño"
        unit="horas"
        onConfirm={handleConfirmSleep}
        onClose={() => setActiveModal(null)}
      />
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

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.card,
    padding: spacing.lg,
    width: '100%',
    ...shadows.card,
  },
  title: {
    ...textStyles.titleSmall,
    color: colors.neutral.black,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  input: {
    ...textStyles.bodyNormal,
    color: colors.neutral.darkGray,
    borderWidth: 1.5,
    borderColor: colors.neutral.lightGray,
    borderRadius: borderRadius.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: 20,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1.5,
    borderColor: colors.neutral.lightGray,
    alignItems: 'center',
  },
  btnCancelText: {
    ...textStyles.bodyNormal,
    color: colors.neutral.midGray,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.primary.green,
    alignItems: 'center',
  },
  btnConfirmText: {
    ...textStyles.bodyNormal,
    color: colors.neutral.white,
    fontWeight: '700',
  },
});
