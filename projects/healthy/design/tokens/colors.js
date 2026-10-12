/**
 * Tokens de color del sistema de diseño Healthy
 * Paleta principal, colores semánticos y modo oscuro
 */

export const colors = {
  // Paleta principal
  primary: {
    green:      '#22C55E', // acciones principales, progreso, éxito
    darkGreen:  '#16A34A', // hover, pressed states
    lightGreen: '#DCFCE7', // fondos suaves, badges de éxito
  },

  // Neutros
  neutral: {
    white:     '#FFFFFF', // fondos principales
    offWhite:  '#F9FAFB', // fondos secundarios, cards
    lightGray: '#F3F4F6', // separadores, fondos terciarios
    midGray:   '#9CA3AF', // textos secundarios, placeholders
    darkGray:  '#1F2937', // textos principales
    black:     '#111827', // títulos, énfasis
  },

  // Colores semánticos
  semantic: {
    success: '#22C55E', // objetivos cumplidos, racha activa
    warning: '#F59E0B', // alertas suaves, recordatorios
    error:   '#EF4444', // errores, límites superados
    info:    '#3B82F6', // información, consejos de la IA
  },

  // Modo oscuro (app)
  dark: {
    background:      '#0A0A0A',
    surface:         '#1A1A1A',
    surfaceElevated: '#2A2A2A',
    border:          '#2D2D2D',
    textPrimary:     '#F9FAFB',
    textSecondary:   '#9CA3AF',
  },

  // Landing page — estilo Tag Heuer (oscuro, premium, cinemático)
  landing: {
    bg:           '#080808',
    bgSurface:    '#111111',
    bgElevated:   '#161616',
    bgOverlay:    'rgba(0,0,0,0.65)',
    text:         '#FFFFFF',
    textSubtle:   'rgba(255,255,255,0.72)',
    textMuted:    'rgba(255,255,255,0.40)',
    border:       'rgba(255,255,255,0.08)',
    borderMid:    'rgba(255,255,255,0.16)',
    accent:       '#22C55E',
    accentGlow:   'rgba(34,197,94,0.20)',
    accentMuted:  'rgba(34,197,94,0.12)',
  },

  // Métricas Whoop-inspired (dark cards, data-first)
  whoop: {
    bg:           '#0F0F0F',
    card:         '#1C1C1E',
    cardBorder:   'rgba(255,255,255,0.06)',
    recovery:     '#22C55E',   // verde — recovery alto
    recoveryMid:  '#F59E0B',   // amarillo — recovery medio
    recoveryLow:  '#EF4444',   // rojo — recovery bajo
    strain:       '#3B82F6',   // azul — strain/carga
    sleep:        '#8B5CF6',   // morado — sueño
    hrv:          '#EC4899',   // rosa — HRV
    textVal:      '#FFFFFF',
    textLabel:    'rgba(255,255,255,0.50)',
    graphLine:    'rgba(255,255,255,0.15)',
  },
};

export default colors;
