import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '@/navigation/RootNavigator';
import { Button }  from '@/components/ui/Button';
import { Input }   from '@/components/ui/Input';
import { colors }  from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { authService } from '@/services/authService';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSend = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Email no válido'); return; }
    setLoading(true);
    try { await authService.forgotPassword(email.trim()); }
    catch {}
    finally { setLoading(false); setSent(true); }
  };

  if (sent) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={s.back}>← Volver al login</Text></TouchableOpacity>
        <View style={s.iconCircle}><Text style={{ fontSize: 38 }}>📬</Text></View>
        <Text style={s.title}>Revisa tu email</Text>
        <Text style={s.sub}>Si existe una cuenta con <Text style={s.bold}>{email}</Text>, recibirás un enlace en los próximos minutos.</Text>
        <Text style={s.spam}>¿No lo ves? Revisa la carpeta de spam.</Text>
        <Button label="Volver al inicio de sesión" variant="secondary" onPress={() => navigation.navigate('Login')} style={s.cta} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.center}>
          <TouchableOpacity onPress={() => navigation.goBack()}><Text style={s.back}>← Volver</Text></TouchableOpacity>
          <Text style={s.title}>Recuperar contraseña</Text>
          <Text style={s.sub}>Introduce tu email y te enviaremos un enlace para crear una nueva contraseña</Text>
          <Input label="Email" value={email} onChangeText={(t) => { setEmail(t); setError(''); }} keyboardType="email-address" errorMessage={error} inputProps={{ autoCapitalize: 'none' }} />
          <Button label="Enviar enlace" variant="primary" loading={loading} onPress={handleSend} style={s.cta} />
          <View style={s.footer}>
            <Text style={s.subText}>¿Recuerdas tu contraseña? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}><Text style={s.link}>Inicia sesión</Text></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.white }, flex: { flex: 1 },
  center: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  back:   { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },
  title:  { ...textStyles.titleMedium, color: colors.neutral.black },
  sub:    { ...textStyles.bodyNormal, color: colors.neutral.midGray, lineHeight: 22 },
  bold:   { fontWeight: '600', color: colors.neutral.darkGray },
  cta:    {},
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary.lightGreen, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  spam:   { ...textStyles.caption, color: colors.neutral.midGray, textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center' },
  subText:{ ...textStyles.bodyNormal, color: colors.neutral.midGray },
  link:   { ...textStyles.bodyNormal, color: colors.primary.darkGreen, fontWeight: '600' },
});
export default ForgotPasswordScreen;
