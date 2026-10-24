/**
 * PrivacyScreen — «Privacidad y datos» (SEC-47 / SEC-48, RGPD).
 *  - Retirar el consentimiento de datos de salud (art. 7.3 y 9) → DELETE /onboarding/health-consent
 *  - Eliminar la cuenta (art. 17) → DELETE /user/me con la contraseña actual
 * Confirmación explícita y texto claro de qué se borra en ambos casos.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import ReAnimated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { useAuthStore }       from '@/stores/authStore';
import { usePlanStore }       from '@/stores/planStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Button }             from '@/components/ui/Button';
import { Input }              from '@/components/ui/Input';
import {
  privacyService, apiErrorCode, PRIVACY_ERRORS,
  type HealthConsentStatus, type WithdrawConsentResult,
} from '@/services/privacyService';
import { colors }     from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius, shadows } from '@/theme/spacing';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Respeta «Reducir movimiento» del sistema
const fadeIn = FadeIn.duration(220).reduceMotion(ReduceMotion.System);

const HEALTH_DATA_DELETED = [
  'Condiciones médicas',
  'Alergias e intolerancias alimentarias',
  'Lesiones y limitaciones físicas',
];

const ACCOUNT_DATA_DELETED = [
  'Tu cuenta, email y perfil físico',
  'Plan de entrenamiento y nutrición',
  'Historial de entrenos, comidas y progreso',
  'Registros diarios (agua, sueño, pasos, peso)',
  'Datos de salud y respuestas del onboarding',
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// ── Sección: consentimiento de datos de salud ────────────────────────────────

function HealthConsentSection({ onReconsent }: { onReconsent: () => void }) {
  const resetPlan = usePlanStore((s) => s.reset);
  const [status, setStatus]         = useState<HealthConsentStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [withdrawing, setWithdraw]  = useState(false);
  const [result, setResult]         = useState<WithdrawConsentResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStatus(await privacyService.getHealthConsentStatus()); }
    catch { setStatus(null); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const withdraw = async () => {
    setWithdraw(true);
    try {
      const res = await privacyService.withdrawHealthConsent();
      setResult(res);
      setStatus({ valid: false, given_at: null });
      resetPlan(); // el plan en memoria puede reflejar datos de salud ya borrados
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Consentimiento retirado. Tus datos de salud se han borrado.');
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('No se pudo retirar', 'Comprueba tu conexión e inténtalo de nuevo. Tus datos no se han modificado.');
    } finally {
      setWithdraw(false);
    }
  };

  const confirmWithdraw = () => {
    Alert.alert(
      'Retirar consentimiento',
      `Se borrarán de forma permanente:\n• ${HEALTH_DATA_DELETED.join('\n• ')}\n\n`
        + 'Tu cuenta, tu plan actual y tu progreso se conservan. No podrás generar ni regenerar '
        + 'planes con IA hasta que vuelvas a dar tu consentimiento.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Retirar y borrar', style: 'destructive', onPress: withdraw },
      ],
    );
  };

  return (
    <View style={s.card}>
      <Text style={s.cardTitle} accessibilityRole="header">Datos de salud</Text>
      <Text style={s.body}>
        Con tu consentimiento explícito (art. 9 RGPD) usamos tus condiciones médicas, lesiones,
        alergias e intolerancias para adaptar tu plan con IA. Puedes retirarlo cuando quieras.
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.primary.darkGreen} style={{ marginVertical: spacing.sm }}
          accessibilityLabel="Cargando el estado del consentimiento" />
      ) : (
        <View style={[s.pill, status?.valid ? s.pillOn : s.pillOff]} accessible
          accessibilityLabel={status?.valid ? 'Consentimiento vigente' : 'Sin consentimiento vigente'}>
          <Text style={[s.pillText, status?.valid ? s.pillTextOn : s.pillTextOff]}>
            {status === null ? 'Estado no disponible'
              : status.valid ? `Vigente${status.given_at ? ` desde el ${formatDate(status.given_at)}` : ''}`
              : 'No vigente'}
          </Text>
        </View>
      )}

      {result && (
        <ReAnimated.View entering={fadeIn} style={s.notice} accessibilityLiveRegion="polite">
          <Text style={s.noticeText}>
            Consentimiento retirado el {formatDate(result.withdrawn_at)}. Borrado:{' '}
            {result.deleted.conditions} condiciones, {result.deleted.food_restrictions} restricciones
            {result.deleted.injuries_cleared ? ' y tus lesiones' : ''}.
          </Text>
        </ReAnimated.View>
      )}

      {status?.valid ? (
        <Button label={withdrawing ? 'Retirando…' : 'Retirar consentimiento'} variant="secondary"
          onPress={confirmWithdraw} loading={withdrawing} disabled={withdrawing} style={s.actionBtn} />
      ) : !loading && status !== null ? (
        <>
          <Text style={s.hint}>Sin consentimiento no se generan planes con IA.</Text>
          <Button label="Volver a dar mi consentimiento" variant="secondary"
            onPress={onReconsent} style={s.actionBtn} />
        </>
      ) : !loading ? (
        <Button label="Reintentar" variant="ghost" onPress={load} style={s.actionBtn} />
      ) : null}
    </View>
  );
}

// ── Sección: eliminar la cuenta ──────────────────────────────────────────────

function deleteErrorMessage(err: any): string {
  const status = err?.response?.status;
  const code   = apiErrorCode(err);
  if (code === PRIVACY_ERRORS.INVALID_CREDENTIALS) return 'La contraseña no es correcta.';
  if (status === 400) return 'Introduce tu contraseña actual.';
  if (status === 429) return 'Demasiados intentos. Espera 15 minutos y vuelve a probar.';
  if (!err?.response) return 'Sin conexión. Tu cuenta no se ha eliminado.';
  return 'No se pudo eliminar la cuenta. Inténtalo de nuevo más tarde.';
}

function DeleteAccountSection() {
  const clearLocalSession = useAuthStore((st) => st.clearLocalSession);
  const resetPlan         = usePlanStore((st) => st.reset);
  const resetOnboarding   = useOnboardingStore((st) => st.reset);
  const [expanded, setExpanded]     = useState(false);
  const [password, setPassword]     = useState('');
  const [understood, setUnderstood] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error, setError]           = useState<string | undefined>();

  const canDelete = password.length > 0 && understood && !deleting;

  const toggleUnderstood = () => {
    Haptics.selectionAsync();
    setUnderstood((v) => !v);
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError(undefined);
    try {
      await privacyService.deleteAccount(password);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(deleteErrorMessage(err));
      setDeleting(false);
      return;
    }
    // Cuenta ya borrada en el servidor: la sesión no existe, se limpia solo en el
    // dispositivo (sin /auth/logout). Un fallo local no debe mostrarse como fallo del borrado.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    resetPlan();
    resetOnboarding();
    try { await clearLocalSession(); } catch { /* SecureStore: se reintenta en el próximo arranque */ }
    Alert.alert('Cuenta eliminada', 'Tu cuenta y todos tus datos se han eliminado de forma permanente.');
  };

  return (
    <View style={[s.card, s.dangerCard]}>
      <Text style={[s.cardTitle, s.dangerTitle]} accessibilityRole="header">Eliminar cuenta</Text>
      <Text style={s.body}>Se borrará de forma permanente, sin posibilidad de recuperarlo:</Text>
      {ACCOUNT_DATA_DELETED.map((item) => (
        <Text key={item} style={s.bullet}>• {item}</Text>
      ))}
      <Text style={s.hint}>Tus sesiones se cerrarán en todos tus dispositivos.</Text>

      {!expanded ? (
        <Button label="Eliminar mi cuenta" variant="destructive"
          onPress={() => setExpanded(true)} style={s.actionBtn} />
      ) : (
        <ReAnimated.View entering={fadeIn} style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Input
            label="Contraseña actual"
            value={password}
            onChangeText={(t) => { setPassword(t); setError(undefined); }}
            secureText
            errorMessage={error}
            disabled={deleting}
            inputProps={{ autoComplete: 'current-password', textContentType: 'password', autoCapitalize: 'none' }}
          />
          <Pressable
            onPress={toggleUnderstood}
            style={s.checkRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: understood, disabled: deleting }}
            accessibilityLabel="Entiendo que esta acción es permanente y no se puede deshacer"
            disabled={deleting}
            hitSlop={8}
          >
            <View style={[s.checkbox, understood && s.checkboxOn]}>
              {understood && <Text style={s.checkmark}>✓</Text>}
            </View>
            <Text style={s.checkText}>Entiendo que esta acción es permanente y no se puede deshacer.</Text>
          </Pressable>
          <Button
            label={deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
            variant="destructive"
            onPress={handleDelete}
            loading={deleting}
            disabled={!canDelete}
          />
          <Button label="Cancelar" variant="ghost" disabled={deleting}
            onPress={() => { setExpanded(false); setPassword(''); setUnderstood(false); setError(undefined); }} />
        </ReAnimated.View>
      )}
    </View>
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function PrivacyScreen() {
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver al perfil"
          hitSlop={12}
          style={s.back}
        >
          <Text style={s.backText}>‹ Perfil</Text>
        </Pressable>
        <Text style={s.title} accessibilityRole="header">Privacidad y datos</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <HealthConsentSection onReconsent={() => navigation.navigate('OnboardingHealth')} />
        <DeleteAccountSection />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.neutral.offWhite },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  back:   { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { ...textStyles.bodyLarge, color: colors.primary.darkGreen, fontWeight: '600' },
  title:  { ...textStyles.titleMedium, color: colors.neutral.black },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },

  card: {
    backgroundColor: colors.neutral.white, borderRadius: borderRadius.card,
    padding: spacing.md, gap: spacing.sm, ...shadows.card,
  },
  dangerCard:  { borderWidth: 1, borderColor: '#FECACA' },
  cardTitle:   { ...textStyles.titleSmall, color: colors.neutral.black },
  dangerTitle: { color: colors.semantic.error },
  body:   { ...textStyles.bodyNormal, color: colors.neutral.darkGray, lineHeight: 20 },
  bullet: { ...textStyles.bodyNormal, color: colors.neutral.darkGray, paddingLeft: spacing.xs },
  hint:   { ...textStyles.caption, color: colors.neutral.midGray },
  actionBtn: { marginTop: spacing.xs },

  pill: {
    alignSelf: 'flex-start', borderRadius: borderRadius.pill,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
  },
  pillOn:      { backgroundColor: colors.primary.lightGreen },
  pillOff:     { backgroundColor: colors.neutral.lightGray },
  pillText:    { ...textStyles.caption, fontWeight: '700' },
  pillTextOn:  { color: colors.primary.darkGreen },
  pillTextOff: { color: colors.neutral.midGray },

  notice: {
    backgroundColor: colors.neutral.offWhite, borderRadius: borderRadius.input,
    padding: spacing.sm, borderLeftWidth: 3, borderLeftColor: colors.primary.darkGreen,
  },
  noticeText: { ...textStyles.bodyNormal, color: colors.neutral.darkGray },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xs, minHeight: 44 },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    borderColor: colors.neutral.midGray, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.semantic.error, borderColor: colors.semantic.error },
  checkmark:  { color: colors.neutral.white, fontWeight: '700', fontSize: 14 },
  checkText:  { ...textStyles.bodyNormal, color: colors.neutral.darkGray, flex: 1 },
});

export default PrivacyScreen;
