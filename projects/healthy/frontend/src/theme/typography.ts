export const fontSize = {
  titleLarge: 32, titleMedium: 24, titleSmall: 18,
  bodyLarge: 16, bodyNormal: 14, caption: 12, label: 12,
} as const;

export const fontWeight = {
  regular: '400' as const, medium: '500' as const,
  semibold: '600' as const, bold: '700' as const,
};

export const textStyles = {
  titleLarge:  { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 38 },
  titleMedium: { fontSize: 24, fontWeight: '600' as const, letterSpacing: -0.3, lineHeight: 29 },
  titleSmall:  { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 23 },
  bodyLarge:   { fontSize: 16, fontWeight: '400' as const, letterSpacing:  0.15, lineHeight: 26 },
  bodyNormal:  { fontSize: 14, fontWeight: '400' as const, letterSpacing:  0.1,  lineHeight: 21 },
  caption:     { fontSize: 12, fontWeight: '400' as const, letterSpacing:  0.25, lineHeight: 17 },
  label:       { fontSize: 12, fontWeight: '500' as const, letterSpacing:  0.5, lineHeight: 17, textTransform: 'uppercase' as const },
} as const;

export default { fontSize, fontWeight, textStyles };
