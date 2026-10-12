/**
 * Componente Input del sistema de diseño Healthy
 * Label flotante animado, estados: default, focused, error, disabled
 * Altura estándar 56px, fondo offWhite, borde verde al enfocar
 */

import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import colors from '../tokens/colors';
import { fontSize, fontWeight } from '../tokens/typography';
import {
  borderRadius,
  componentHeight,
  duration,
  spacing,
  iconSize,
} from '../tokens/spacing';

/**
 * Input
 *
 * @param {string}   label          - Texto del label flotante
 * @param {string}   value          - Valor controlado del input
 * @param {function} onChangeText   - Callback con el texto actualizado
 * @param {string}   errorMessage   - Mensaje de error (activa estado error)
 * @param {string}   hint           - Texto de ayuda bajo el input
 * @param {boolean}  disabled       - Deshabilita el input
 * @param {boolean}  secureText     - Oculta el texto (contraseñas)
 * @param {string}   keyboardType   - Tipo de teclado nativo
 * @param {node}     leftIcon       - Icono a la izquierda del campo
 * @param {node}     rightElement   - Elemento a la derecha (icono ojo, etc.)
 * @param {object}   style          - Estilos adicionales para el contenedor externo
 * @param {object}   inputProps     - Props extras para TextInput nativo
 */
export function Input({
  label,
  value          = '',
  onChangeText,
  errorMessage,
  hint,
  disabled       = false,
  secureText     = false,
  keyboardType   = 'default',
  leftIcon,
  rightElement,
  style,
  inputProps     = {},
}) {
  const [focused, setFocused] = useState(false);

  // Animación del label: sube y se reduce al enfocar o tener valor
  const labelAnim  = useRef(new Animated.Value(value ? 1 : 0)).current;
  const hasContent = value && value.length > 0;

  const animateLabel = (toValue) => {
    Animated.timing(labelAnim, {
      toValue,
      duration:        duration.normal,
      useNativeDriver: false, // necesita animar layout props
    }).start();
  };

  const handleFocus = () => {
    setFocused(true);
    animateLabel(1);
  };

  const handleBlur = () => {
    setFocused(false);
    if (!hasContent) animateLabel(0);
  };

  // Posición y tamaño interpolados del label flotante
  const labelTop  = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [17, 6] });
  const labelSize = labelAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 11] });
  const labelColor = labelAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.neutral.midGray, errorMessage
      ? colors.semantic.error
      : colors.primary.green],
  });

  // Borde dinámico según estado
  const borderColor = () => {
    if (disabled)      return colors.neutral.lightGray;
    if (errorMessage)  return colors.semantic.error;
    if (focused)       return colors.primary.green;
    return colors.neutral.lightGray;
  };

  return (
    <View style={[styles.wrapper, style]}>
      {/* Contenedor del campo */}
      <View
        style={[
          styles.container,
          { borderColor: borderColor() },
          disabled && styles.containerDisabled,
        ]}
      >
        {/* Icono izquierdo opcional */}
        {leftIcon && (
          <View style={styles.leftIcon}>{leftIcon}</View>
        )}

        {/* Área de texto con label flotante */}
        <View style={styles.inputArea}>
          {/* Label animado */}
          <Animated.Text
            style={[
              styles.label,
              {
                top:      labelTop,
                fontSize: labelSize,
                color:    labelColor,
              },
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>

          {/* Campo de texto nativo */}
          <TextInput
            style={[
              styles.input,
              leftIcon  && styles.inputWithLeftIcon,
              disabled  && styles.inputDisabled,
            ]}
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={secureText}
            keyboardType={keyboardType}
            editable={!disabled}
            placeholderTextColor="transparent" // el label reemplaza el placeholder
            selectionColor={colors.primary.green}
            {...inputProps}
          />
        </View>

        {/* Elemento derecho: icono de error o rightElement personalizado */}
        {(errorMessage || rightElement) && (
          <View style={styles.rightElement}>
            {errorMessage
              ? <ErrorIcon />
              : rightElement}
          </View>
        )}
      </View>

      {/* Mensaje de error */}
      {errorMessage ? (
        <Text style={styles.errorText}>{errorMessage}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

// Icono de error inline (punto rojo + X, sin dependencia de librería externa)
function ErrorIcon() {
  return (
    <View style={errorIconStyles.circle}>
      <Text style={errorIconStyles.x}>✕</Text>
    </View>
  );
}

const errorIconStyles = StyleSheet.create({
  circle: {
    width:           iconSize.inline,
    height:          iconSize.inline,
    borderRadius:    iconSize.inline / 2,
    backgroundColor: colors.semantic.error,
    alignItems:      'center',
    justifyContent:  'center',
  },
  x: {
    color:      colors.neutral.white,
    fontSize:   10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },

  container: {
    height:          componentHeight.input,
    backgroundColor: colors.neutral.offWhite,
    borderRadius:    borderRadius.input,
    borderWidth:     1,
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: spacing.md,
  },

  containerDisabled: {
    backgroundColor: colors.neutral.lightGray,
  },

  leftIcon: {
    marginRight: spacing.sm,
  },

  inputArea: {
    flex:           1,
    justifyContent: 'center',
    position:       'relative',
  },

  label: {
    position:  'absolute',
    left:      0,
    fontSize:  fontSize.bodyLarge, // valor inicial, se anima
    color:     colors.neutral.midGray,
    zIndex:    1,
  },

  input: {
    paddingTop:    18,  // deja espacio para el label flotante
    paddingBottom:  4,
    fontSize:      fontSize.bodyLarge,
    fontWeight:    fontWeight,
    color:         colors.neutral.darkGray,
    height:        '100%',
  },

  inputWithLeftIcon: {
    paddingLeft: 0,
  },

  inputDisabled: {
    color: colors.neutral.midGray,
  },

  rightElement: {
    marginLeft: spacing.sm,
  },

  errorText: {
    marginTop:  spacing.xs,
    fontSize:   fontSize.caption,
    color:      colors.semantic.error,
    marginLeft: spacing.xs,
  },

  hintText: {
    marginTop:  spacing.xs,
    fontSize:   fontSize.caption,
    color:      colors.neutral.midGray,
    marginLeft: spacing.xs,
  },
});

export default Input;
