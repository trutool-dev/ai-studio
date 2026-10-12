/**
 * Tokens de espaciado, bordes, sombras e iconografía del sistema Healthy
 * Sistema basado en múltiplos de 8px
 */

// Espaciado (sistema 8px)
export const spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  xxxl: 64,
};

// Radios de borde
export const borderRadius = {
  input:    12, // inputs
  button:   14, // botones primarios
  card:     20, // cards
  modal:    28, // modales estilo Apple sheet
  pill:     100, // badges y pills — full rounded
};

// Sombras estilo Apple
export const shadows = {
  card: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  20,
    elevation:     3, // Android
  },
  modal: {
    shadowColor:   '#000000',
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius:  40,
    elevation:     8,
  },
  button: {
    shadowColor:   '#22C55E',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius:  12,
    elevation:     4,
  },
};

// Alturas estándar de componentes interactivos
export const componentHeight = {
  button: 56, // botones primarios y secundarios
  input:  56, // campos de texto
};

// Tamaños de iconos
export const iconSize = {
  inline:   20, // iconos dentro de texto o inputs
  standard: 24, // icono estándar de interfaz
  featured: 32, // iconos destacados / tab activo
};

// Duraciones de animación (ms)
export const duration = {
  fast:    100, // pressed state, micro feedback
  normal:  250, // aparición de elementos (fade + slide)
  medium:  300, // transiciones entre pantallas
};

// Escala de pressed state para botones
export const pressedScale = 0.97;

export default { spacing, borderRadius, shadows, componentHeight, iconSize, duration, pressedScale };
