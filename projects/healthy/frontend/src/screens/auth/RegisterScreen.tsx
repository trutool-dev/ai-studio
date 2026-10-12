import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '@/navigation/RootNavigator';
import { Button }    from '@/components/ui/Button';
import { Input }     from '@/components/ui/Input';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing }   from '@/theme/spacing';
import { authService } from '@/services/authService';
import { extractApiError } from '@/utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail]   = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email no válido';
    if (!phone.trim() || !/^\+?[\d\s\-()]{9,}$/.test(phone))         e.phone = 'Teléfono no válido';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authService.register(email.trim(), phone.trim());
      navigation.navigate('VerifyEmail', { email: email.trim() });
    } catch (err: any) {
      setErrors({ general: extractApiError(err, 'Error al registrar') });
    } finally { setLoading(false); }
  };

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
          <Text style={s.title}>Crea tu cuenta</Text>
          <Text style={s.sub}>Te enviaremos un código de verificación a tu email</Text>
          <Input label="Email"     value={email} onChangeText={(t) => { setEmail(t); setErrors((e) => ({...e, email: ''})); }} keyboardType="email-address" errorMessage={errors.email} inputProps={{ autoCapitalize: 'none' }} />
          <Input label="Teléfono" value={phone} onChangeText={(t) => { setPhone(t); setErrors((e) => ({...e, phone: ''})); }} keyboardType="phone-pad"    errorMessage={errors.phone} hint="+34 612 345 678" style={s.gap} />
          {errors.general ? <Text style={s.error}>{errors.general}</Text> : null}
          <Button label="Continuar" variant="primary" loading={loading} onPress={handleRegister} style={s.cta} />
          <View style={s.footer}>
            <Text style={s.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={s.link}>Inicia sesión</Text></TouchableOpacity>
          </View>
          <Text style={s.legal}>Al registrarte aceptas nuestros Términos de uso y Política de privacidad</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral.white }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  back:  { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },
  title: { ...textStyles.titleMedium, color: colors.neutral.black },
  sub:   { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  gap:   { marginTop: 0 },
  error: { ...textStyles.caption, color: colors.semantic.error, textAlign: 'center' },
  cta:   { marginTop: spacing.md },
  footer:{ flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  link:  { ...textStyles.bodyNormal, color: colors.primary.darkGreen, fontWeight: '600' },
  legal: { ...textStyles.caption, color: colors.neutral.midGray, textAlign: 'center', lineHeight: 18 },
});
export default RegisterScreen;
