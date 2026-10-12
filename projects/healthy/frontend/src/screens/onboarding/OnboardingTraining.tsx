import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps }            from '@react-navigation/native-stack';
import { RootStackParamList }                from '@/navigation/RootNavigator';
import { useOnboardingStore, Equipment, Experience } from '@/stores/onboardingStore';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectCard }       from './SelectCard';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import api from '@/services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingTraining'>;

export function OnboardingTraining({ navigation }: Props) {
  const { data, setTraining } = useOnboardingStore();
  const prev = data.training;
  const [days,       setDays]       = useState<number    | undefined>(prev?.daysPerWeek);
  const [equipment,  setEquipment]  = useState<Equipment[]>(prev?.equipment ?? []);
  const [experience, setExperience] = useState<Experience | undefined>(prev?.experience);
  const [loading,    setLoading]    = useState(false);

  const toggleEq = (item: Equipment) => setEquipment((p) => {
    if (item === 'none') return ['none'];
    const f = p.filter((e) => e !== 'none');
    return f.includes(item) ? f.filter((e) => e !== item) : [...f, item];
  });

  const handleContinue = async () => {
    const trainingData = { daysPerWeek: days!, equipment, experience: experience! };
    setLoading(true);
    try {
      await api.put('/onboarding/training', {
        days_per_week: trainingData.daysPerWeek,
        equipment:     trainingData.equipment,
        experience:    trainingData.experience,
      });
      setTraining(trainingData);
      navigation.navigate('OnboardingNutrition');
    } catch {
      setTraining(trainingData);
      navigation.navigate('OnboardingNutrition');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={4}
      title="Tu entrenamiento"
      subtitle="Diseñamos sesiones que encajen con tu tiempo y recursos"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      canContinue={!!days && equipment.length > 0 && !!experience}
      loading={loading}
    >
      <Text style={s.sec}>Días disponibles por semana</Text>
      <View style={s.daysRow}>
        {[1,2,3,4,5,6,7].map((d) => (
          <Pressable
            key={d}
            onPress={() => setDays(d)}
            style={[s.dayBtn, days === d && s.dayBtnSel]}
            accessibilityLabel={`${d} días`}
          >
            <Text style={[s.dayNum, days === d && s.dayNumSel]}>{d}</Text>
          </Pressable>
        ))}
      </View>
      {days && (
        <Text style={s.daysHint}>{days === 1 ? '1 sesión' : `${days} sesiones`} a la semana</Text>
      )}

      <Text style={[s.sec, { marginTop: spacing.lg }]}>Equipamiento disponible</Text>
      <View style={s.grid}>
        {([
          { value: 'gym',      icon: '🏋️', label: 'Gimnasio'    },
          { value: 'home',     icon: '🏠', label: 'En casa'     },
          { value: 'outdoors', icon: '🌳', label: 'Aire libre'  },
          { value: 'none',     icon: '🤲', label: 'Sin material' },
        ] as { value: Equipment; icon: string; label: string }[]).map((e) => (
          <Pressable
            key={e.value}
            onPress={() => toggleEq(e.value)}
            style={[s.equipCard, equipment.includes(e.value) && s.equipCardSel]}
            accessibilityLabel={e.label}
            accessibilityState={{ selected: equipment.includes(e.value) }}
          >
            <Text style={{ fontSize: 28 }}>{e.icon}</Text>
            <Text style={[s.equipLabel, equipment.includes(e.value) && s.equipLabelSel]}>{e.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.sec, { marginTop: spacing.lg }]}>Nivel de experiencia</Text>
      {([
        { value: 'beginner',     icon: '🌱', label: 'Principiante', sublabel: 'Menos de 6 meses'  },
        { value: 'intermediate', icon: '🏃', label: 'Intermedio',   sublabel: '6 meses – 2 años'  },
        { value: 'advanced',     icon: '🏆', label: 'Avanzado',     sublabel: 'Más de 2 años'     },
      ] as { value: Experience; icon: string; label: string; sublabel: string }[]).map((e) => (
        <SelectCard key={e.value} icon={e.icon} label={e.label} sublabel={e.sublabel} selected={experience === e.value} onPress={() => setExperience(e.value)} />
      ))}
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  sec:      { ...textStyles.label, color: colors.neutral.midGray, marginBottom: spacing.sm },
  daysRow:  { flexDirection: 'row', gap: spacing.xs },
  dayBtn:   { flex: 1, height: 44, borderRadius: borderRadius.input, borderWidth: 1.5, borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  dayBtnSel:{ borderColor: colors.primary.green, backgroundColor: colors.primary.green },
  dayNum:   { ...textStyles.bodyNormal, fontWeight: '700', color: colors.neutral.midGray },
  dayNumSel:{ color: colors.neutral.white },
  daysHint: { ...textStyles.caption, color: colors.primary.green, fontWeight: '600', textAlign: 'center', marginTop: spacing.sm },
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipCard:    { width: '47%', padding: spacing.md, borderRadius: borderRadius.card, borderWidth: 1.5, borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite, alignItems: 'center', gap: spacing.sm, ...shadows.card },
  equipCardSel: { borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  equipLabel:   { ...textStyles.bodyNormal, fontWeight: '600', color: colors.neutral.darkGray, textAlign: 'center' },
  equipLabelSel:{ color: colors.primary.darkGreen },
});
export default OnboardingTraining;
