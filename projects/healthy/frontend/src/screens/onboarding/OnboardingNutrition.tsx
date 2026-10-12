import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps }            from '@react-navigation/native-stack';
import { RootStackParamList }                from '@/navigation/RootNavigator';
import { useOnboardingStore, DietType, Budget } from '@/stores/onboardingStore';
import { OnboardingLayout } from './OnboardingLayout';
import { SelectCard }       from './SelectCard';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';
import api from '@/services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingNutrition'>;

const RESTRICTIONS = [
  { id: 'lactose',   label: 'Lactosa',      icon: '🥛' },
  { id: 'nuts',      label: 'Frutos secos', icon: '🥜' },
  { id: 'shellfish', label: 'Mariscos',     icon: '🦐' },
  { id: 'eggs',      label: 'Huevos',       icon: '🥚' },
  { id: 'soy',       label: 'Soja',         icon: '🫘' },
  { id: 'fish',      label: 'Pescado',      icon: '🐟' },
];

export function OnboardingNutrition({ navigation }: Props) {
  const { data, setNutrition } = useOnboardingStore();
  const prev = data.nutrition;
  const [diet,    setDiet]    = useState<DietType | undefined>(prev?.dietType);
  const [restr,   setRestr]   = useState<string[]>(prev?.restrictions ?? []);
  const [budget,  setBudget]  = useState<Budget   | undefined>(prev?.budget);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const nutritionData = { dietType: diet!, restrictions: restr, budget: budget! };
    setLoading(true);
    try {
      await api.put('/onboarding/nutrition', {
        diet_type:    nutritionData.dietType,
        restrictions: nutritionData.restrictions,
        budget:       nutritionData.budget,
      });
      setNutrition(nutritionData);
      navigation.navigate('OnboardingHealth');
    } catch {
      setNutrition(nutritionData);
      navigation.navigate('OnboardingHealth');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={5}
      title="Tu alimentación"
      subtitle="Creamos menús que disfrutes y se ajusten a tu forma de comer"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      canContinue={!!diet && !!budget}
      loading={loading}
    >
      <Text style={s.sec}>¿Cómo te alimentas?</Text>
      {([
        { value: 'omnivore',    icon: '🍗', label: 'Omnívoro',    sublabel: 'Como de todo'                    },
        { value: 'vegetarian',  icon: '🥦', label: 'Vegetariano', sublabel: 'Sin carne ni pescado'            },
        { value: 'vegan',       icon: '🌱', label: 'Vegano',      sublabel: 'Solo productos vegetales'        },
        { value: 'gluten_free', icon: '🌾', label: 'Sin gluten',  sublabel: 'Celíaco o intolerante'           },
        { value: 'keto',        icon: '🥑', label: 'Keto',        sublabel: 'Alta en grasas, baja en hidratos'},
        { value: 'other',       icon: '🍽️', label: 'Otra',        sublabel: ''                               },
      ] as { value: DietType; icon: string; label: string; sublabel: string }[]).map((d) => (
        <SelectCard key={d.value} icon={d.icon} label={d.label} sublabel={d.sublabel} selected={diet === d.value} onPress={() => setDiet(d.value)} />
      ))}

      <Text style={[s.sec, { marginTop: spacing.lg }]}>Intolerancias o alergias</Text>
      <Text style={s.hint}>Opcional</Text>
      <View style={s.tags}>
        {RESTRICTIONS.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setRestr(p => p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id])}
            style={[s.tag, restr.includes(r.id) && s.tagSel]}
            accessibilityLabel={r.label}
            accessibilityState={{ selected: restr.includes(r.id) }}
          >
            <Text style={{ fontSize: 16 }}>{r.icon}</Text>
            <Text style={[s.tagLabel, restr.includes(r.id) && s.tagLabelSel]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[s.sec, { marginTop: spacing.lg }]}>Presupuesto mensual en alimentación</Text>
      {([
        { value: 'low',    icon: '💰', label: 'Ajustado',    sublabel: 'Menos de 150€/mes'   },
        { value: 'medium', icon: '💳', label: 'Moderado',    sublabel: '150 – 300€/mes'      },
        { value: 'high',   icon: '💎', label: 'Sin límite',  sublabel: 'Priorizo calidad'    },
      ] as { value: Budget; icon: string; label: string; sublabel: string }[]).map((b) => (
        <SelectCard key={b.value} icon={b.icon} label={b.label} sublabel={b.sublabel} selected={budget === b.value} onPress={() => setBudget(b.value)} />
      ))}
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  sec:   { ...textStyles.label, color: colors.neutral.midGray, marginBottom: spacing.sm },
  hint:  { ...textStyles.caption, color: colors.neutral.midGray, marginBottom: spacing.sm, marginTop: -spacing.xs },
  tags:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  tag:   { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.pill, borderWidth: 1.5, borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite, ...shadows.card },
  tagSel:      { borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  tagLabel:    { ...textStyles.bodyNormal, color: colors.neutral.darkGray },
  tagLabelSel: { color: colors.primary.darkGreen, fontWeight: '600' },
});
export default OnboardingNutrition;
