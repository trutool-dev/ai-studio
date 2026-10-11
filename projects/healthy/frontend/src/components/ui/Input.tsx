import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle, KeyboardTypeOptions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { colors }   from '@/theme/colors';
import { fontSize } from '@/theme/typography';
import { borderRadius, componentHeight, spacing, iconSize } from '@/theme/spacing';

// Easing estilo Apple — ease-out suave (equivale a CSS cubic-bezier(0.23,1,0.32,1))
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const TIMING   = { duration: 200, easing: EASE_OUT };

// Posición vertical del label: arranca centrado (top=17) y sube a (top=6)
const LABEL_TOP_IDLE   = 17;
const LABEL_TOP_ACTIVE = 6;
// Escala: de fontSize 16 (idle) a fontSize ≈11 (active) → ratio 11/16
const SCALE_IDLE   = 1;
const SCALE_ACTIVE = 0.6875;

interface InputProps {
  label: string; value: string; onChangeText: (t: string) => void;
  errorMessage?: string; hint?: string; disabled?: boolean;
  secureText?: boolean; keyboardType?: KeyboardTypeOptions;
  leftIcon?: React.ReactNode; rightElement?: React.ReactNode;
  style?: ViewStyle; inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'secureTextEntry' | 'keyboardType' | 'editable'>;
}

export function Input({ label, value = '', onChangeText, errorMessage, hint, disabled = false, secureText = false, keyboardType = 'default', leftIcon, rightElement, style, inputProps = {} }: InputProps) {
  const [focused, setFocused] = useState(false);
  const hasContent = value.length > 0;

  // 0 = idle (vacío, sin foco) · 1 = active (con foco o con contenido)
  const progress = useSharedValue(value ? 1 : 0);

  const animate = (v: number) => {
    progress.value = withTiming(v, TIMING);
  };

  const borderColor = disabled
    ? colors.neutral.lightGray
    : errorMessage
    ? colors.semantic.error
    : focused
    ? colors.primary.green
    : colors.neutral.lightGray;

  const labelIdleColor   = colors.neutral.midGray;
  const labelActiveColor = errorMessage ? colors.semantic.error : colors.primary.green;

  // Animación de label: translateY + scale (sin layout pass).
  // transformOrigin:'left' fija el pivote en el extremo izquierdo del texto.
  const labelAnimStyle = useAnimatedStyle(() => {
    const translateY = withTiming(
      progress.value * (LABEL_TOP_ACTIVE - LABEL_TOP_IDLE),
      TIMING
    );
    const scale = withTiming(
      SCALE_IDLE + progress.value * (SCALE_ACTIVE - SCALE_IDLE),
      TIMING
    );

    return {
      transform: [{ translateY }, { scale }],
      color: interpolateColor(
        progress.value,
        [0, 1],
        [labelIdleColor, labelActiveColor]
      ) as string,
    };
  });

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.container, { borderColor }, disabled && styles.disabled]}>
        {leftIcon && <View style={{ marginRight: spacing.sm }}>{leftIcon}</View>}
        <View style={styles.inputArea}>
          <Animated.Text style={[styles.label, labelAnimStyle]} numberOfLines={1}>
            {label}
          </Animated.Text>
          <TextInput
            style={[styles.input, disabled && { color: colors.neutral.midGray }]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => { setFocused(true); animate(1); }}
            onBlur={() => { setFocused(false); if (!hasContent) animate(0); }}
            secureTextEntry={secureText}
            keyboardType={keyboardType}
            editable={!disabled}
            placeholderTextColor="transparent"
            selectionColor={colors.primary.green}
            {...inputProps}
          />
        </View>
        {(errorMessage || rightElement) && (
          <View style={{ marginLeft: spacing.sm }}>
            {errorMessage ? <ErrorIcon /> : rightElement}
          </View>
        )}
      </View>
      {errorMessage
        ? <Text style={styles.errorText}>{errorMessage}</Text>
        : hint
        ? <Text style={styles.hintText}>{hint}</Text>
        : null}
    </View>
  );
}

function ErrorIcon() {
  return (
    <View style={{ width: iconSize.inline, height: iconSize.inline, borderRadius: iconSize.inline / 2, backgroundColor: colors.semantic.error, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.neutral.white, fontSize: 10, fontWeight: '700', lineHeight: 12 }}>✕</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:   { width: '100%' },
  container: { height: componentHeight.input, backgroundColor: colors.neutral.offWhite, borderRadius: borderRadius.input, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  disabled:  { backgroundColor: colors.neutral.lightGray },
  inputArea: { flex: 1, justifyContent: 'center', position: 'relative' },
  // El label arranca en top=LABEL_TOP_IDLE; el transform lo desplaza hacia arriba
  label:     { position: 'absolute', left: 0, top: LABEL_TOP_IDLE, fontSize: fontSize.bodyLarge, color: colors.neutral.midGray, zIndex: 1, transformOrigin: 'left' },
  input:     { paddingTop: 18, paddingBottom: 4, fontSize: fontSize.bodyLarge, color: colors.neutral.darkGray, height: '100%' },
  errorText: { marginTop: spacing.xs, fontSize: fontSize.caption, color: colors.semantic.error, marginLeft: spacing.xs },
  hintText:  { marginTop: spacing.xs, fontSize: fontSize.caption, color: colors.neutral.midGray, marginLeft: spacing.xs },
});

export default Input;
