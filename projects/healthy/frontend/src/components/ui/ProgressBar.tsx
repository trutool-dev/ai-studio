import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { colors }    from '@/theme/colors';
import { textStyles } from '@/theme/typography';
import { spacing, borderRadius } from '@/theme/spacing';

interface ProgressBarProps {
  current:    number;
  total:      number;
  hideLabel?: boolean;
  style?:     ViewStyle;
  accessibilityLabel?: string;
}

export function ProgressBar({ current, total, hideLabel = false, style, accessibilityLabel }: ProgressBarProps) {
  const progress = Math.min(Math.max(current / total, 0), 1);

  // scaleX anima desde 0 a 1 aplicado sobre un fill que ocupa el 100% del track
  const scaleX = useSharedValue(progress);

  useEffect(() => {
    // withSpring con dampingRatio=1 (sin rebote) y duration=400ms
    scaleX.value = withSpring(progress, { duration: 400, dampingRatio: 1 });
  }, [progress]);

  // transformOrigin='left' fija el pivote de escala en el extremo izquierdo
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: scaleX.value }],
  }));

  return (
    <View
      style={[styles.wrapper, style]}
      accessibilityLabel={accessibilityLabel ?? `Progreso: ${current} de ${total}`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
    >
      {!hideLabel && (
        <Text style={styles.label}>
          {current} <Text style={styles.total}>/ {total}</Text>
        </Text>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', gap: spacing.xs },
  label:   { ...textStyles.label, color: colors.primary.darkGreen, alignSelf: 'flex-end' }, // FE-12: darkGreen
  total:   { color: colors.neutral.midGray },
  track:   { height: 6, borderRadius: borderRadius.pill, backgroundColor: colors.neutral.lightGray, overflow: 'hidden' },
  // fill ocupa el 100% y se escala horizontalmente desde la izquierda
  fill:    { height: '100%', width: '100%', borderRadius: borderRadius.pill, backgroundColor: colors.primary.darkGreen, transformOrigin: 'left' }, // FE-12
});

export default ProgressBar;
