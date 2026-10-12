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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuthStore();
  const [email, setEmail]   = useState('');
  const [pwd, setPwd]       = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email no válido';
    if (!pwd) e.pwd = 'Contraseña obligatoria';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const auth = await authService.login(email.trim(), pwd);
      await login(auth.user, auth.access_token, auth.refresh_token);
      // La navegación la gestiona RootNavigator en función de isAuthenticated
    } catch (err: any) {
      const msg = err.response?.status === 401
        ? 'Email o contraseña incorrectos'
        : extractApiError(err, 'Error al iniciar sesión');
      setErrors({ general: msg });
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
          <Text style={s.title}>Bienvenido de nuevo</Text>
          <Text style={s.sub}>Inicia sesión para continuar con tu plan</Text>
          <Input label="Email" value={email} onChangeText={(t) => { setEmail(t); setErrors({}); }}
            keyboardType="email-address" errorMessage={errors.email}
            inputProps={{ autoCapitalize: 'none' }} />
          <Input label="Contraseña" value={pwd} onChangeText={(t) => { setPwd(t); setErrors({}); }}
            secureText={!showPwd} errorMessage={errors.pwd} style={s.gap}
            rightElement={
              <TouchableOpacity
                onPress={() => setShowPwd(v => !v)}
                accessibilityLabel={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={{ fontSize: 18 }}>{showPwd ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            } />
          {errors.general ? <Text style={s.error}>{errors.general}</Text> : null}
          <TouchableOpacity
            style={s.forgot}
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityLabel="¿Olvidaste tu contraseña?"
          >
            <Text style={s.link}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>
          <Button label="Iniciar sesión" variant="primary" loading={loading} onPress={handleLogin} style={s.cta} />
          <View style={s.footer}>
            <Text style={s.footerText}>¿No tienes cuenta? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              accessibilityLabel="Regístrate gratis"
            >
              <Text style={s.link}>Regístrate gratis</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral.white }, flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  back:   { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },
  title:  { ...textStyles.titleMedium, color: colors.neutral.black },
  sub:    { ...textStyles.bodyNormal, color: colors.neutral.midGray },
  gap:    {},
  error:  { ...textStyles.caption, color: '#DC2626', textAlign: 'center' },
  forgot: { alignSelf: 'flex-end' },
  link:   { ...textStyles.bodyNormal, color: colors.primary.darkGreen, fontWeight: '600' },
  cta:    {},
  footer: { flexDirection: 'row', justifyContent: 'center' },
  footerText: { ...textStyles.bodyNormal, color: colors.neutral.midGray },
});
export default LoginScreen;
