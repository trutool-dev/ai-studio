/**
 * Tokens de tipografía del sistema de diseño Healthy
 * Fuentes, tamaños, pesos, alturas de línea y tracking
 */

export const fontFamily = {
  // SF Pro Display en iOS, Roboto en Android
  ios:     'SF Pro Display',
  android: 'Roboto',
};

export const fontSize = {
  titleLarge:  32,
  titleMedium: 24,
  titleSmall:  18,
  bodyLarge:   16,
  bodyNormal:  14,
  caption:     12,
  label:       12,
};

export const fontWeight = {
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
};

export const lineHeight = {
  titleLarge:  1.2,  // ratio sobre fontSize
  titleMedium: 1.2,
  titleSmall:  1.3,
  bodyLarge:   1.6,
  bodyNormal:  1.5,
  caption:     1.4,
  label:       1.4,
};

export const letterSpacing = {
  titleLarge:  -0.5,
  titleMedium: -0.3,
  titleSmall:  -0.2,
  bodyLarge:    0,
  bodyNormal:   0,
  caption:      0,
  label:        0.5,  // uppercase + tracking amplio
};

// Estilos de texto predefinidos listos para usar en componentes
export const textStyles = {
  titleLarge: {
    fontSize:      fontSize.titleLarge,
    fontWeight:    fontWeight.bold,
    letterSpacing: letterSpacing.titleLarge,
    lineHeight:    fontSize.titleLarge * lineHeight.titleLarge,
  },
  titleMedium: {
    fontSize:      fontSize.titleMedium,
    fontWeight:    fontWeight.semibold,
    letterSpacing: letterSpacing.titleMedium,
    lineHeight:    fontSize.titleMedium * lineHeight.titleMedium,
  },
  titleSmall: {
    fontSize:      fontSize.titleSmall,
    fontWeight:    fontWeight.semibold,
    letterSpacing: letterSpacing.titleSmall,
    lineHeight:    fontSize.titleSmall * lineHeight.titleSmall,
  },
  bodyLarge: {
    fontSize:      fontSize.bodyLarge,
    fontWeight:    fontWeight.regular,
    letterSpacing: letterSpacing.bodyLarge,
    lineHeight:    fontSize.bodyLarge * lineHeight.bodyLarge,
  },
  bodyNormal: {
    fontSize:      fontSize.bodyNormal,
    fontWeight:    fontWeight.regular,
    letterSpacing: letterSpacing.bodyNormal,
    lineHeight:    fontSize.bodyNormal * lineHeight.bodyNormal,
  },
  caption: {
    fontSize:      fontSize.caption,
    fontWeight:    fontWeight.regular,
    letterSpacing: letterSpacing.caption,
    lineHeight:    fontSize.caption * lineHeight.caption,
  },
  label: {
    fontSize:      fontSize.label,
    fontWeight:    fontWeight.medium,
    letterSpacing: letterSpacing.label,
    lineHeight:    fontSize.label * lineHeight.label,
    textTransform: 'uppercase',
  },
};

export default { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles };
