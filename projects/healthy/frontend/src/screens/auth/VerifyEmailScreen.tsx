import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, SafeAreaView, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList }     from '@/navigation/RootNavigator';
import { Button }    from '@/components/ui/Button';
import { colors }    from '@/theme/colors';
import { textStyles, fontSize } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';
import { authService } from '@/services/authService';
import { extractApiError } from '@/utils/errors';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;
const CODE_LENGTH = 6;

export function VerifyEmailScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const [digits, setDigits]       = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const refs = useRef<(TextInput | null)[]>(Array(CODE_LENGTH).fill(null));

  const handleDigit = (text: string, i: number) => {
    const d = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits]; next[i] = d; setDigits(next); setError('');
    if (d && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) { setError('Introduce los 6 dígitos'); return; }
    setLoading(true);
    try {
      // Solo verificamos — la contraseña se establece en el siguiente paso
      await authService.verifyEmail(email, code);
      navigation.navigate('SetPassword', { email, code });
    } catch (err: any) {
      setError(extractApiError(err, 'Código incorrecto'));
      setDigits(Array(CODE_LENGTH).fill(''));
      refs.current[0]?.focus();
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setResending(true); setError(''); setResendMsg('');
    try { await authService.resendCode(email); setResendMsg('Código reenviado.'); }
    catch { setError('No se pudo reenviar.'); }
    finally { setResending(false); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.container}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver atrás"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.back}>← Volver</Text>
          </TouchableOpacity>
          <Text style={s.title}>Revisa tu email</Text>
          <Text style={s.sub}>Código de 6 dígitos enviado a{'\n'}<Text style={s.email}>{email}</Text></Text>
          <View style={s.codeRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(r) => { refs.current[i] = r; }}
                style={[s.digit, d && s.digitFilled, !!error && s.digitError]}
                value={d}
                onChangeText={(t) => handleDigit(t, i)}
                onKeyPress={({ nativeEvent: { key } }) => {
                  if (key === 'Backspace' && !d && i > 0) refs.current[i-1]?.focus();
                }}
                keyboardType="number-pad" maxLength={1} selectTextOnFocus
                selectionColor={colors.primary.green}
                accessibilityLabel={`Dígito ${i + 1} del código`}
              />
            ))}
          </View>
          {error    ? <Text style={s.error}>{error}</Text>     : null}
          {resendMsg? <Text style={s.success}>{resendMsg}</Text>: null}
          <Button
            label="Verificar"
            variant="primary"
            loading={loading}
            disabled={digits.join('').length < CODE_LENGTH}
            onPress={handleVerify}
            style={s.cta}
          />
          <View style={s.resendRow}>
            <Text style={s.resendText}>¿No recibiste el código? </Text>
            {resending
              ? <ActivityIndicator size="small" color={colors.primary.green} />
              : (
                <TouchableOpacity
                  onPress={handleResend}
                  accessibilityLabel="Reenviar código de verificación"
                >
                  <Text style={s.link}>Reenviar</Text>
                </TouchableOpacity>
              )
            }
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral.white }, flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  back:  { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg },
  title: { ...textStyles.titleMedium, color: colors.neutral.black, marginBottom: spacing.sm },
  sub:   { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.xl, lineHeight: 22 },
  email: { color: colors.neutral.darkGray, fontWeight: '600' },
  codeRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  digit:      { flex: 1, height: 52, borderRadius: borderRadius.input, borderWidth: 1.5, borderColor: colors.neutral.lightGray, backgroundColor: colors.neutral.offWhite, textAlign: 'center', fontSize: fontSize.titleSmall, fontWeight: '700', color: colors.neutral.black },
  digitFilled:{ borderColor: colors.primary.green, backgroundColor: colors.primary.lightGreen },
  digitError: { borderColor: '#DC2626' },
  error:   { ...textStyles.caption, color: '#DC2626', textAlign: 'center', marginBottom: spacing.md },
  success: { ...textStyles.caption, color: '#16A34A', textAlign: 'center', marginBottom: spacing.md },
  cta:     { marginBottom: spacing.lg },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendText:{ ...textStyles.bodyNormal, color: colors.neutral.midGray },
  link:      { ...textStyles.bodyNormal, color: colors.primary.darkGreen, fontWeight: '600' },
});
export default VerifyEmailScreen;
