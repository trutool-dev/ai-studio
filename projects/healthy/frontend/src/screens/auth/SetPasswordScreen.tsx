import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '@/navigation/RootNavigator';
import { Button }       from '@/components/ui/Button';
import { Input }        from '@/components/ui/Input';
import { colors }       from '@/theme/colors';
import { textStyles }   from '@/theme/typography';
import { spacing }      from '@/theme/spacing';
import { useAuthStore } from '@/stores/authStore';
import { authService }  from '@/services/authService';
import { extractApiError } from '@/utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'SetPassword'>;

const STRENGTH_COLORS = ['#DC2626', '#DC2626', '#D97706', '#16A34A', '#16A34A'];
const STRENGTH_LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Muy fuerte'];
function getStrength(p: string) {
  return [p.length >= 8, /[A-Z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)].filter(Boolean).length;
}

export function SetPasswordScreen({ navigation, route }: Props) {
  const { email, code } = route.params;
  const { login }       = useAuthStore();
  const [pwd, setPwd]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  const strength = getStrength(pwd);

  const validate = () => {
    const e: Record<string, string> = {};
    if (pwd.length < 8 || strength < 2) e.pwd = 'Contraseña demasiado débil (mín. 8 chars)';
    if (pwd !== confirm) e.confirm = 'Las contraseñas no coinciden';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const auth = await authService.setPassword(email, code, pwd);
      await login(auth.user, auth.access_token, auth.refresh_token);
      // Navegar a onboarding porque el usuario acaba de crear la cuenta
      navigation.replace('OnboardingWelcome');
    } catch (err: any) {
      setErrors({ general: extractApiError(err, 'Error al crear contraseña') });
    } finally { setLoading(false); }
  };

  const Eye = ({ show, onToggle, label }: { show: boolean; onToggle: () => void; label: string }) => (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityLabel={label}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={{ fontSize: 18 }}>{show ? '🙈' : '👁'}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver atrás"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={s.title}>Crea tu contraseña</Text>
          <Text style={s.sub}>Elige una contraseña segura para proteger tu cuenta</Text>
          <Input label="Contraseña" value={pwd}
            onChangeText={(t) => { setPwd(t); setErrors((e) => ({...e, pwd: ''})); }}
            secureText={!showPwd} errorMessage={errors.pwd}
            rightElement={<Eye show={showPwd} onToggle={() => setShowPwd(v => !v)} label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} />} />
          {pwd.length > 0 && (
            <View style={s.strengthRow}>
              {[0,1,2,3].map((i) => (
                <View key={i} style={[s.bar, { backgroundColor: i < strength ? STRENGTH_COLORS[strength] : colors.neutral.lightGray }]} />
              ))}
              <Text style={[s.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>{STRENGTH_LABELS[strength]}</Text>
            </View>
          )}
          <Input label="Confirmar contraseña" value={confirm}
            onChangeText={(t) => { setConfirm(t); setErrors((e) => ({...e, confirm: ''})); }}
            secureText={!showConf} errorMessage={errors.confirm} style={s.gap}
            rightElement={<Eye show={showConf} onToggle={() => setShowConf(v => !v)} label={showConf ? 'Ocultar confirmación' : 'Mostrar confirmación'} />} />
          {errors.general ? <Text style={s.error}>{errors.general}</Text> : null}
          <View style={s.reqs}>
            {[
              ['Mínimo 8 caracteres',    pwd.length >= 8],
              ['Una mayúscula',          /[A-Z]/.test(pwd)],
              ['Un número',             /[0-9]/.test(pwd)],
              ['Un carácter especial',  /[^A-Za-z0-9]/.test(pwd)],
            ].map(([label, met]) => (
              <View key={label as string} style={s.req}>
                <Text style={[s.reqIcon, met && s.reqIconMet]}>{met ? '✓' : '○'}</Text>
                <Text style={[s.reqLabel, met && s.reqLabelMet]}>{label as string}</Text>
              </View>
            ))}
          </View>
          <Button label="Crear cuenta" variant="primary" loading={loading} onPress={handleSubmit} style={s.cta} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral.white }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  back: { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },
  title:{ ...textStyles.titleMedium, color: colors.neutral.black },
  sub:  { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  gap:  {},
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bar: { flex: 1, height: 4, borderRadius: 100 },
  strengthLabel: { ...textStyles.caption, fontWeight: '600', minWidth: 70 },
  error: { ...textStyles.caption, color: '#DC2626', textAlign: 'center' },
  reqs: { gap: spacing.xs },
  req: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reqIcon: { fontSize: 14, color: colors.neutral.midGray, width: 16 },
  reqIconMet: { color: '#16A34A' },
  reqLabel: { ...textStyles.caption, color: colors.neutral.midGray },
  reqLabelMet: { color: colors.neutral.darkGray },
  cta: {},
});
export default SetPasswordScreen;
