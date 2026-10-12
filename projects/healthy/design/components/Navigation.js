/**
 * Componente Navigation del sistema de diseño Healthy
 * Tab bar translúcido con efecto blur (estilo cristal Apple)
 * Iconos outline en reposo, filled al seleccionar
 * Indicador: punto verde bajo el icono activo
 * Sin labels — solo iconos
 */

import React, { useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import colors from '../tokens/colors';
import { iconSize, spacing, duration } from '../tokens/spacing';

// En un proyecto real se importaría BlurView de @react-native-community/blur
// o expo-blur. Aquí exportamos el componente completo con un fallback.
let BlurView;
try {
  BlurView = require('@react-native-community/blur').BlurView;
} catch {
  // fallback: fondo blanco semiopaco si la librería no está disponible
  BlurView = ({ children, style }) => (
    <View style={[style, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
      {children}
    </View>
  );
}

/**
 * TabBar
 *
 * @param {Array}  tabs        - Array de objetos tab (ver forma abajo)
 * @param {number} activeIndex - Índice de la pestaña activa
 * @param {function} onChange  - Callback con el índice seleccionado
 * @param {boolean} darkMode   - Activa paleta oscura
 *
 * Forma de cada objeto tab:
 * {
 *   key:        string,   // identificador único
 *   IconOutline: Component, // icono outline (inactivo)
 *   IconFilled:  Component, // icono filled  (activo)
 *   accessibilityLabel: string,
 * }
 */
export function TabBar({
  tabs         = [],
  activeIndex  = 0,
  onChange,
  darkMode     = false,
}) {
  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <BlurView
        style={[styles.bar, darkMode && styles.barDark]}
        blurType={darkMode ? 'dark' : 'light'}
        blurAmount={20}
        reducedTransparencyFallbackColor={
          darkMode ? colors.dark.surface : colors.neutral.white
        }
      >
        <View style={styles.tabsRow}>
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.key}
              tab={tab}
              isActive={index === activeIndex}
              onPress={() => onChange?.(index)}
              darkMode={darkMode}
            />
          ))}
        </View>
      </BlurView>
    </View>
  );
}

// ── Tab individual ─────────────────────────────────────────────────────────────

function TabItem({ tab, isActive, onPress, darkMode }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim   = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  const handlePress = () => {
    // Micro-feedback al pulsar
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue:         0.88,
        duration:        duration.fast,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue:         1,
        duration:        duration.fast,
        useNativeDriver: true,
      }),
    ]).start();

    // Anima el punto indicador
    Animated.timing(dotAnim, {
      toValue:         isActive ? 1 : 0,
      duration:        duration.normal,
      useNativeDriver: true,
    }).start();

    onPress?.();
  };

  // El punto aparece con fade al seleccionar
  const dotOpacity = dotAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 1],
  });

  const iconColor = isActive
    ? colors.primary.green
    : darkMode
      ? colors.dark.textSecondary
      : colors.neutral.midGray;

  const IconComponent = isActive ? tab.IconFilled : tab.IconOutline;

  return (
    <Pressable
      style={styles.tab}
      onPress={handlePress}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={tab.accessibilityLabel}
    >
      {/* Icono animado */}
      <Animated.View style={[
        styles.iconContainer,
        { transform: [{ scale: scaleAnim }] },
      ]}>
        {IconComponent ? (
          <IconComponent
            width={iconSize.standard}
            height={iconSize.standard}
            color={iconColor}
          />
        ) : (
          // Placeholder si no se pasa icono (útil en desarrollo)
          <View style={[
            styles.iconPlaceholder,
            { backgroundColor: iconColor },
          ]} />
        )}
      </Animated.View>

      {/* Punto indicador verde bajo el icono */}
      <Animated.View style={[styles.dot, { opacity: dotOpacity }]} />
    </Pressable>
  );
}

// ── Header de navegación ───────────────────────────────────────────────────────

/**
 * NavHeader — cabecera de pantalla con título centrado y botones opcionales
 *
 * @param {string}  title       - Título de la pantalla
 * @param {node}    leftAction  - Elemento en la zona izquierda (botón back, etc.)
 * @param {node}    rightAction - Elemento en la zona derecha (botón acción, etc.)
 * @param {boolean} darkMode    - Activa texto claro sobre fondo oscuro
 * @param {object}  style       - Estilos adicionales
 */
export function NavHeader({
  title,
  leftAction,
  rightAction,
  darkMode = false,
  style,
}) {
  return (
    <View style={[headerStyles.container, style]}>
      <View style={headerStyles.side}>
        {leftAction}
      </View>

      <View style={headerStyles.titleArea} pointerEvents="none">
        <Animated.Text
          style={[
            headerStyles.title,
            darkMode && headerStyles.titleDark,
          ]}
          numberOfLines={1}
        >
          {title}
        </Animated.Text>
      </View>

      <View style={[headerStyles.side, headerStyles.sideRight]}>
        {rightAction}
      </View>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const BAR_HEIGHT      = 82;
const BOTTOM_INSET    = Platform.OS === 'ios' ? 28 : 0; // espacio para home indicator
const DOT_SIZE        = 5;

const styles = StyleSheet.create({
  wrapper: {
    position:       'absolute',
    bottom:         0,
    left:           0,
    right:          0,
    alignItems:     'center',
  },

  bar: {
    width:          '100%',
    height:         BAR_HEIGHT + BOTTOM_INSET,
    paddingBottom:  BOTTOM_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },

  barDark: {
    borderTopColor: colors.dark.border,
  },

  tabsRow: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
  },

  tab: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight:      48, // área táctil mínima WCAG
  },

  iconContainer: {
    alignItems:     'center',
    justifyContent: 'center',
    width:          iconSize.featured,
    height:         iconSize.featured,
  },

  iconPlaceholder: {
    width:        iconSize.standard,
    height:       iconSize.standard,
    borderRadius: iconSize.standard / 2,
    opacity:      0.4,
  },

  dot: {
    marginTop:       4,
    width:           DOT_SIZE,
    height:          DOT_SIZE,
    borderRadius:    DOT_SIZE / 2,
    backgroundColor: colors.primary.green,
  },
});

const headerStyles = StyleSheet.create({
  container: {
    height:          56,
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },

  side: {
    width:          56,
    alignItems:     'flex-start',
    justifyContent: 'center',
  },

  sideRight: {
    alignItems: 'flex-end',
  },

  titleArea: {
    flex:       1,
    alignItems: 'center',
  },

  title: {
    fontSize:      17,   // estándar iOS para títulos de nav
    fontWeight:    '600',
    color:         colors.neutral.black,
    letterSpacing: -0.2,
  },

  titleDark: {
    color: colors.dark.textPrimary,
  },
});

export default TabBar;
