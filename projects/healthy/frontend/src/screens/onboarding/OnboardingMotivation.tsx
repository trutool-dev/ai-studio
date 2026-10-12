import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown }            from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { NativeStackScreenProps }          from '@react-navigation/native-stack';
import { RootStackParamList }              from '@/navigation/RootNavigator';
import { useOnboardingStore, PreviousAttempts } from '@/stores/onboardingStore';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectCard }       from './SelectCard';
import { Input }            from '@/components/ui/Input';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import api from '@/services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingMotivation'>;

const MOTIVATIONS = [
  { id: 'health',       label: 'Mejorar mi salud',  icon: '❤️' },
  { id: 'appearance',   label: 'Verme mejor',       icon: '🪞' },
  { id: 'energy',       label: 'Más energía',       icon: '⚡' },
  { id: 'confidence',   label: 'Ganar confianza',   icon: '💪' },
  { id: 'sleep',        label: 'Dormir mejor',      icon: '😴' },
  { id: 'stress',       label: 'Reducir el estrés', icon: '🧘' },
  { id: 'performance',  label: 'Rendir mejor',      icon: '🏅' },
  { id: 'longevity',    label: 'Vivir más y mejor', icon: '🌿' },
];

const PREVIOUS_ATTEMPTS: { value: PreviousAttempts; icon: string; label: string; sublabel: string }[] = [
  { value: 'none', icon: '🆕', label: 'Es mi primera vez',       sublabel: 'Nunca he seguido un plan'  },
  { value: 'few',  icon: '📋', label: 'Lo he intentado antes',   sublabel: '1 o 2 intentos previos'    },
  { value: 'many', icon: '🔄', label: 'He probado muchas cosas', sublabel: 'Sin resultados duraderos'  },
];

// Chip de motivación con FadeInDown stagger (delay 40ms — chips pequeños y rápidos)
function MotivationChip({
  item,
  index,
  selected,
  onPress,
}: {
  item: (typeof MOTIVATIONS)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const entering = useMemo(
    () => FadeInDown.duration(200).delay(index * 40),
    [index],
  );

  return (
    <Animated.View entering={entering}>
      <Pressable
        onPressIn={() => Haptics.selectionAsync()}
        onPress={onPress}
        style={[s.tag, selected && s.tagSel]}
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
      >
        <Text style={{ fontSize: 16 }}>{item.icon}</Text>
        <Text style={[s.tagLabel, selected && s.tagLabelSel]}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

// SelectCard de intentos previos con FadeInDown stagger
function AttemptOption({
  item,
  index,
  selected,
  onPress,
}: {
  item: (typeof PREVIOUS_ATTEMPTS)[number];
  index: number;
  selected: boolean;
  onPress: () => void;
}) {
  const entering = useMemo(
    () => FadeInDown.duration(200).delay(index * 40),
    [index],
  );

  return (
    <Animated.View entering={entering}>
      <SelectCard
        icon={item.icon}
        label={item.label}
        sublabel={item.sublabel}
        selected={selected}
        onPress={onPress}
      />
    </Animated.View>
  );
}

export function OnboardingMotivation({ navigation }: Props) {
  const { data, setMotivation } = useOnboardingStore();
  const prev = data.motivation;
  const [motivations, setMotivations] = useState<string[]>(prev?.motivations   ?? []);
  const [attempts,    setAttempts]    = useState<PreviousAttempts | undefined>(prev?.previousAttempts);
  const [challenge,   setChallenge]   = useState(prev?.mainChallenge ?? '');
  const [loading,     setLoading]     = useState(false);

  const handleContinue = async () => {
    const motivationData = { motivations, previousAttempts: attempts!, mainChallenge: challenge };
    setLoading(true);
    try {
      await api.put('/onboarding/motivation', {
        motivations:       motivationData.motivations,
        previous_attempts: motivationData.previousAttempts,
        main_challenge:    motivationData.mainChallenge,
      });
      setMotivation(motivationData);
      navigation.navigate('OnboardingComplete');
    } catch {
      setMotivation(motivationData);
      navigation.navigate('OnboardingComplete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={7}
      title="Tu motivación"
      subtitle="Entender qué te mueve nos ayuda a diseñar un plan que no abandones"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      continueLabel="Generar mi plan"
      canContinue={motivations.length > 0 && !!attempts}
      loading={loading}
    >
      <Text style={s.sec}>¿Por qué quieres mejorar tu salud?</Text>
      <Text style={s.hint}>Selecciona todas las que te representen</Text>
      <View style={s.tags}>
        {MOTIVATIONS.map((m, index) => (
          <MotivationChip
            key={m.id}
            item={m}
            index={index}
            selected={motivations.includes(m.id)}
            onPress={() => setMotivations(p => p.includes(m.id) ? p.filter(x => x !== m.id) : [...p, m.id])}
          />
        ))}
      </View>

      <Text style={[s.sec, { marginTop: spacing.lg }]}>¿Has seguido planes de salud antes?</Text>
      {PREVIOUS_ATTEMPTS.map((a, index) => (
        <AttemptOption
          key={a.value}
          item={a}
          index={index}
          selected={attempts === a.value}
          onPress={() => setAttempts(a.value)}
        />
      ))}

      <Text style={[s.sec, { marginTop: spacing.lg }]}>
        ¿Cuál es tu mayor reto? <Text style={s.optional}>(opcional)</Text>
      </Text>
      <Input
        label="Ej: la constancia, el tiempo, saber qué comer…"
        value={challenge}
        onChangeText={setChallenge}
        hint="La IA lo tendrá en cuenta"
        inputProps={{ autoCapitalize: 'sentences' }}
      />
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  sec:      { ...textStyles.label, color: colors.neutral.midGray, marginBottom: spacing.xs },
  hint:     { ...textStyles.caption, color: colors.neutral.midGray, marginBottom: spacing.md },
  optional: { fontWeight: '400', textTransform: 'none' },
  tags:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tag:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.pill, borderWidth: 1.5, borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite, ...shadows.card },
  tagSel:       { borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  tagLabel:     { ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  tagLabelSel:  { color: colors.primary.darkGreen, fontWeight: '600' },
});
export default OnboardingMotivation;
