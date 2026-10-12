/**
 * useTheme — detecta el modo de color del sistema y devuelve tokens de color
 * adaptados para modo claro y oscuro (FE-10).
 *
 * Uso:
 *   const { isDark, theme } = useTheme();
 *   <View style={{ backgroundColor: theme.background }} />
 */

import { useColorScheme } from 'react-native';
import { colors } from '@/theme/colors';

export interface ThemeColors {
  background:      string;
  surface:         string;
  surfaceElevated: string;
  border:          string;
  textPrimary:     string;
  textSecondary:   string;
  // Alias heredados para compatibilidad con componentes existentes
  white:       string;
  offWhite:    string;
  lightGray:   string;
  midGray:     string;
  darkGray:    string;
  black:       string;
}

const LIGHT: ThemeColors = {
  background:      colors.neutral.offWhite,
  surface:         colors.neutral.white,
  surfaceElevated: colors.neutral.white,
  border:          colors.neutral.lightGray,
  textPrimary:     colors.neutral.black,
  textSecondary:   colors.neutral.midGray,
  white:       colors.neutral.white,
  offWhite:    colors.neutral.offWhite,
  lightGray:   colors.neutral.lightGray,
  midGray:     colors.neutral.midGray,
  darkGray:    colors.neutral.darkGray,
  black:       colors.neutral.black,
};

const DARK: ThemeColors = {
  background:      colors.dark.background,
  surface:         colors.dark.surface,
  surfaceElevated: colors.dark.surfaceElevated,
  border:          colors.dark.border,
  textPrimary:     colors.dark.textPrimary,
  textSecondary:   colors.dark.textSecondary,
  white:       colors.dark.surface,
  offWhite:    colors.dark.background,
  lightGray:   colors.dark.border,
  midGray:     colors.dark.textSecondary,
  darkGray:    colors.dark.textPrimary,
  black:       colors.dark.textPrimary,
};

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    theme: isDark ? DARK : LIGHT,
    colorScheme: scheme,
  };
}
