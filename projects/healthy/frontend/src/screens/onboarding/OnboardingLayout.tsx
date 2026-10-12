import React from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button }      from '@/components/ui/Button';
import { colors }      from '@/theme/colors';
import { textStyles }  from '@/theme/typography';
import { spacing }     from '@/theme/spacing';

export const TOTAL_STEPS = 7;

interface OnboardingLayoutProps {
  step: number; title: string; subtitle?: string;
  onBack: () => void; onContinue: () => void;
  continueLabel?: string; canContinue?: boolean; loading?: boolean;
  children: React.ReactNode; scrollable?: boolean; contentStyle?: ViewStyle;
}

export function OnboardingLayout({ step, title, subtitle, onBack, onContinue, continueLabel = 'Continuar', canContinue = true, loading = false, children, scrollable = true, contentStyle }: OnboardingLayoutProps) {
  const inner = (
    <>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Text style={s.backIcon}>←</Text></TouchableOpacity>
        <ProgressBar current={step} total={TOTAL_STEPS} style={s.progress} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      <View style={[s.content, contentStyle]}>{children}</View>
    </>
  );

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {scrollable
          ? <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{inner}</ScrollView>
          : <View style={[s.scroll, s.flex]}>{inner}</View>}
        <View style={s.footer}>
          <Button label={continueLabel} variant="primary" disabled={!canContinue} loading={loading} onPress={onContinue} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.neutral.white },
  flex:     { flex: 1 },
  scroll:   { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
  header:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  backBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 22, color: colors.neutral.darkGray },
  progress: { flex: 1 },
  title:    { ...textStyles.titleMedium, color: colors.neutral.black, marginBottom: spacing.sm },
  subtitle: { ...textStyles.bodyNormal, color: colors.neutral.midGray, marginBottom: spacing.lg, lineHeight: 22 },
  content:  { flex: 1 },
  footer:   { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.neutral.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.neutral.lightGray },
});
