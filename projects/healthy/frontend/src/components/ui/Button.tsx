import React from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { borderRadius, shadows, componentHeight } from '@/theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

interface ButtonProps {
  variant?: ButtonVariant; label: string; onPress?: () => void;
  disabled?: boolean; loading?: boolean; style?: ViewStyle; labelStyle?: TextStyle;
  leftIcon?: React.ReactNode; rightIcon?: React.ReactNode;
}

export function Button({ variant = 'primary', label, onPress, disabled = false, loading = false, style, labelStyle, leftIcon, rightIcon }: ButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const timingConfig = { duration: 120, easing: Easing.bezier(0.23, 1, 0.32, 1) };

  const isDisabled = disabled || loading;
  const v = isDisabled ? 'disabled' : variant;

  const handlePressIn = () => {
    scale.value = withTiming(0.97, timingConfig);
    if (!isDisabled && (variant === 'primary' || variant === 'destructive')) {
      Haptics.impactAsync(
        variant === 'destructive'
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, timingConfig);
  };

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPress={!isDisabled ? onPress : undefined}
        onPressIn={!isDisabled ? handlePressIn : undefined}
        onPressOut={!isDisabled ? handlePressOut : undefined}
        style={[styles.base, styles[v]]}
        accessibilityRole="button" accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={label}
      >
        {loading ? (
          <ActivityIndicator color={v === 'primary' || v === 'destructive' ? colors.neutral.white : colors.primary.green} size="small" />
        ) : (
          <View style={styles.content}>
            {leftIcon  && <View style={styles.iconLeft}>{leftIcon}</View>}
            <Text style={[styles.label, styles[`${v}Label` as keyof typeof styles] as TextStyle, labelStyle]}>{label}</Text>
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base:             { height: componentHeight.button, borderRadius: borderRadius.button, alignItems: 'center', justifyContent: 'center', width: '100%', paddingHorizontal: 24 },
  content:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft:         { marginRight: 8 },
  iconRight:        { marginLeft: 8 },
  label:            { ...textStyles.bodyLarge, fontWeight: '600' },
  primary:          { backgroundColor: colors.primary.darkGreen, ...shadows.button }, // FE-12: #16A34A cumple WCAG AA
  secondary:        { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary.darkGreen },
  ghost:            { backgroundColor: 'transparent' },
  destructive:      { backgroundColor: '#DC2626' }, // FE-12: contraste suficiente
  disabled:         { backgroundColor: colors.neutral.lightGray },
  primaryLabel:     { color: colors.neutral.white },
  secondaryLabel:   { color: colors.primary.darkGreen },
  ghostLabel:       { color: colors.primary.darkGreen },
  destructiveLabel: { color: colors.neutral.white },
  disabledLabel:    { color: colors.neutral.midGray },
});

export default Button;
