/**
 * Toast — notificación de red y errores (FE-11).
 * Uso:
 *   <Toast message="Error de red" type="error" visible={show} onHide={() => setShow(false)} />
 *
 * Para uso global sin prop-drilling, usar el hook useToast().
 *
 * Animaciones (AD-6b + AD-6c):
 *  - Migrado de Core Animated a Reanimated
 *  - Respeta prefers-reduced-motion: si está activo solo FadeIn/FadeOut sin translateY
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSpring,
  useReducedMotion, Easing,
} from 'react-native-reanimated';
import { colors }     from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface ToastProps {
  message:  string;
  type?:    ToastType;
  visible:  boolean;
  onHide?:  () => void;
  duration?: number; // ms, default 3000
}

const BG: Record<ToastType, string> = {
  error:   '#DC2626',
  success: '#16A34A',
  info:    '#3B82F6',
  warning: '#D97706',
};

const ICON: Record<ToastType, string> = {
  error:   '✕',
  success: '✓',
  info:    'ℹ',
  warning: '⚠',
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function Toast({ message, type = 'error', visible, onHide, duration = 3000 }: ToastProps) {
  const reduced    = useReducedMotion();
  const translateY = useSharedValue(-100);
  const opacity    = useSharedValue(0);

  const hide = () => {
    if (reduced) {
      // Solo fundido, sin movimiento
      opacity.value = withTiming(0, { duration: 150, easing: EASE_OUT }, (finished) => {
        if (finished) {
          // Llamar onHide en el hilo JS
        }
      });
      // Usar setTimeout para dejar que la animación termine antes de ocultar
      setTimeout(() => onHide?.(), 160);
    } else {
      // Slide down + fade out
      translateY.value = withTiming(-100, { duration: 250, easing: EASE_OUT });
      opacity.value    = withTiming(0,    { duration: 250, easing: EASE_OUT });
      setTimeout(() => onHide?.(), 260);
    }
  };

  useEffect(() => {
    if (visible) {
      if (reduced) {
        // Solo fundido, sin translateY
        translateY.value = 0;
        opacity.value    = withTiming(1, { duration: 200, easing: EASE_OUT });
      } else {
        // Spring entrada desde arriba
        translateY.value = -100;
        opacity.value    = withTiming(1, { duration: 300, easing: EASE_OUT });
        translateY.value = withSpring(0, { duration: 300, dampingRatio: 0.75 });
      }

      // Auto-dismiss
      const timer = setTimeout(() => { hide(); }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, reduced]);

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: BG[type] },
        animStyle,
      ]}
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
    >
      <Text style={styles.icon}>{ICON[type]}</Text>
      <Text style={styles.message} numberOfLines={3}>{message}</Text>
      <TouchableOpacity
        onPress={hide}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Cerrar notificación"
      >
        <Text style={styles.close}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position:          'absolute',
    top:               spacing.xl,
    left:              spacing.lg,
    right:             spacing.lg,
    zIndex:            9999,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    borderRadius:      borderRadius.card,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.15,
    shadowRadius:      12,
    elevation:         8,
  },
  icon:    { fontSize: 16, color: colors.neutral.white, fontWeight: '700', width: 20, textAlign: 'center' },
  message: { ...textStyles.bodyNormal, color: colors.neutral.white, flex: 1, lineHeight: 20 },
  close:   { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '700' },
});

export default Toast;
