import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackScreenProps }               from '@react-navigation/native-stack';
import { RootStackParamList }                   from '@/navigation/RootNavigator';
import { useOnboardingStore, BodyType, Gender } from '@/stores/onboardingStore';
import { OnboardingLayout }                     from './OnboardingLayout';
import { SelectCard }                           from './SelectCard';
import { Input }                                from '@/components/ui/Input';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing }   from '@/theme/spacing';
import api from '@/services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'OnboardingProfile'>;

export function OnboardingProfile({ navigation }: Props) {
  const { data, setProfile } = useOnboardingStore();
  const prev = data.profile;
  const [gender,   setGender]   = useState<Gender   | undefined>(prev?.gender);
  const [age,      setAge]      = useState(prev?.age?.toString()    ?? '');
  const [weight,   setWeight]   = useState(prev?.weight?.toString() ?? '');
  const [height,   setHeight]   = useState(prev?.height?.toString() ?? '');
  const [bodyType, setBodyType] = useState<BodyType | undefined>(prev?.bodyType);
  const [errors,   setErrors]   = useState<Record<string,string>>({});
  const [loading,  setLoading]  = useState(false);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!gender)                                                        e.gender   = 'Requerido';
    if (!age    || isNaN(+age)    || +age    < 10  || +age    > 100)   e.age      = 'Edad 10-100';
    if (!weight || isNaN(+weight) || +weight < 30  || +weight > 300)   e.weight   = 'Peso 30-300 kg';
    if (!height || isNaN(+height) || +height < 100 || +height > 250)   e.height   = 'Altura 100-250 cm';
    if (!bodyType)                                                       e.bodyType = 'Requerido';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    const profileData = { gender: gender!, age: +age, weight: +weight, height: +height, bodyType: bodyType! };
    setLoading(true);
    try {
      await api.put('/onboarding/profile', {
        goal:       data.goal,
        gender:     profileData.gender,
        age:        profileData.age,
        weight_kg:  profileData.weight,
        height_cm:  profileData.height,
        body_type:  profileData.bodyType,
      });
      setProfile(profileData);
      navigation.navigate('OnboardingLifestyle');
    } catch {
      // Si falla la llamada, guardamos localmente y continuamos
      setProfile(profileData);
      navigation.navigate('OnboardingLifestyle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      step={2}
      title="Tu perfil físico"
      subtitle="Lo usaremos para calcular tus necesidades calóricas y de entrenamiento"
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
      canContinue={!!(gender && age && weight && height && bodyType)}
      loading={loading}
    >
      <Text style={s.label}>Género</Text>
      <View style={s.genderRow}>
        {([
          { value: 'male',   icon: '♂️', label: 'Hombre' },
          { value: 'female', icon: '♀️', label: 'Mujer'  },
          { value: 'other',  icon: '⚧',  label: 'Otro'   },
        ] as { value: Gender; icon: string; label: string }[]).map((g) => (
          <SelectCard key={g.value} icon={g.icon} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} style={s.genderCard} />
        ))}
      </View>
      <View style={s.metrics}>
        <Input label="Edad"   value={age}    onChangeText={(t) => { setAge(t);    setErrors(e => ({...e, age: ''}));    }} keyboardType="number-pad"   errorMessage={errors.age}    hint="años" style={s.metric} />
        <Input label="Peso"   value={weight} onChangeText={(t) => { setWeight(t); setErrors(e => ({...e, weight: ''})); }} keyboardType="decimal-pad"  errorMessage={errors.weight} hint="kg"   style={s.metric} />
        <Input label="Altura" value={height} onChangeText={(t) => { setHeight(t); setErrors(e => ({...e, height: ''})); }} keyboardType="number-pad"   errorMessage={errors.height} hint="cm"   style={s.metric} />
      </View>
      <Text style={[s.label, { marginTop: spacing.lg }]}>Complexión</Text>
      {([
        { value: 'slim',       icon: '🪶', label: 'Delgado/a',   sublabel: 'Dificultad para ganar peso'      },
        { value: 'athletic',   icon: '🏃', label: 'Atlético/a',  sublabel: 'Musculado/a, poca grasa'         },
        { value: 'average',    icon: '🙂', label: 'Promedio',    sublabel: 'Constitución media'              },
        { value: 'overweight', icon: '🍃', label: 'Con sobrepeso', sublabel: 'Quiero reducir grasa'          },
      ] as { value: BodyType; icon: string; label: string; sublabel: string }[]).map((b) => (
        <SelectCard key={b.value} icon={b.icon} label={b.label} sublabel={b.sublabel} selected={bodyType === b.value} onPress={() => setBodyType(b.value)} />
      ))}
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  label:     { ...textStyles.label, color: colors.neutral.midGray, marginBottom: spacing.sm },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  genderCard:{ flex: 1, marginBottom: 0 },
  metrics:   { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  metric:    { flex: 1 },
});
export default OnboardingProfile;
