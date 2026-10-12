/**
 * Componente Button del sistema de diseño Healthy
 * Variantes: primary, secondary, ghost, destructive, disabled
 * Incluye animación de pressed state (escala 0.97, 100ms)
 */

import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
import colors    from '../tokens/colors';
import { textStyles }               from '../tokens/typography';
import { borderRadius, shadows, componentHeight, duration, pressedScale } from '../tokens/spacing';

// Variantes disponibles del botón
const VARIANTS = {
  primary:      'primary',
  secondary:    'secondary',
  ghost:        'ghost',
  destructive:  'destructive',
  outlineWhite: 'outlineWhite', // para fondos oscuros (landing)
  landingCta:   'landingCta',   // CTA prominente sobre fondo negro
};

/**
 * Button
 *
 * @param {string}   variant     - 'primary' | 'secondary' | 'ghost' | 'destructive'
 * @param {string}   label       - Texto del botón
 * @param {function} onPress     - Callback al pulsar
 * @param {boolean}  disabled    - Deshabilita el botón
 * @param {boolean}  loading     - Muestra spinner en lugar del label
 * @param {object}   style       - Estilos adicionales para el contenedor
 * @param {object}   labelStyle  - Estilos adicionales para el texto
 * @param {node}     leftIcon    - Nodo icono a la izquierda del label
 * @param {node}     rightIcon   - Nodo icono a la derecha del label
 */
export function Button({
  variant     = 'primary',
  label,
  onPress,
  disabled    = false,
  loading     = false,
  style,
  labelStyle,
  leftIcon,
  rightIcon,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animación de escala al presionar (estilo Apple)
  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue:         pressedScale,
      duration:        duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue:         1,
      duration:        duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const isDisabled = disabled || loading;
  const resolvedVariant = isDisabled ? 'disabled' : variant;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={!isDisabled ? onPress : undefined}
        onPressIn={!isDisabled ? handlePressIn : undefined}
        onPressOut={!isDisabled ? handlePressOut : undefined}
        style={[styles.base, styles[resolvedVariant]]}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={label}
      >
        {loading ? (
          // Spinner de carga
          <ActivityIndicator
            color={variant === 'primary' || variant === 'destructive'
              ? colors.neutral.white
              : colors.primary.green}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

            <Text style={[styles.label, styles[`${resolvedVariant}Label`], labelStyle]}>
              {label}
            </Text>

            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Base compartida por todas las variantes
  base: {
    height:         componentHeight.button,
    borderRadius:   borderRadius.button,
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    paddingHorizontal: 24,
  },

  content: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
  },

  iconLeft:  { marginRight: 8 },
  iconRight: { marginLeft:  8 },

  // ── Variantes de fondo / borde ──────────────────────────────────────────────

  primary: {
    backgroundColor: colors.primary.green,
    ...shadows.button,
  },

  secondary: {
    backgroundColor: 'transparent',
    borderWidth:      1.5,
    borderColor:      colors.primary.green,
  },

  ghost: {
    backgroundColor: 'transparent',
  },

  destructive: {
    backgroundColor: colors.semantic.error,
  },

  disabled: {
    backgroundColor: colors.neutral.lightGray,
  },

  // Borde blanco semitransparente — para fondos oscuros tipo landing
  outlineWhite: {
    backgroundColor: 'transparent',
    borderWidth:      1.5,
    borderColor:      'rgba(255,255,255,0.40)',
  },

  // CTA de landing: fondo verde con glow — máxima prominencia
  landingCta: {
    backgroundColor: colors.primary.green,
    shadowColor:     colors.primary.green,
    shadowOffset:    { width: 0, height: 0 },
    shadowOpacity:   0.45,
    shadowRadius:    24,
    elevation:       6,
  },

  // ── Variantes de texto ──────────────────────────────────────────────────────

  label: {
    ...textStyles.bodyLarge,
    fontWeight: '600',
  },

  primaryLabel: {
    color: colors.neutral.white,
  },

  secondaryLabel: {
    color: colors.primary.green,
  },

  ghostLabel: {
    color: colors.primary.green,
  },

  destructiveLabel: {
    color: colors.neutral.white,
  },

  disabledLabel: {
    color: colors.neutral.midGray,
  },

  outlineWhiteLabel: {
    color: colors.neutral.white,
  },

  landingCtaLabel: {
    color:         colors.neutral.white,
    letterSpacing: 0.3,
  },
});

export default Button;
