/**
 * Saneado de texto que se interpola en prompts del LLM (SEC-38 / JB-06, SEC-58 / JB-15).
 *
 * Módulo sin dependencias para poder usarlo desde aiService y desde el selector
 * de ejercicios sin crear ciclos de require.
 *
 * Defensa principal: neutralizar los caracteres estructurales del prompt
 * (`<`, `>`, separadores `---`/`===`, encabezados `##`, backticks) para que un
 * dato de usuario no pueda cerrar `<user_data>` ni falsificar secciones.
 * La lista negra de patrones es solo telemetría (no se confía en ella).
 */

'use strict';

// Patrones de inyección conocidos — solo telemetría (se marcan, no son la defensa)
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions?/gi,
  /ignora\s+(?:todas\s+)?(?:las\s+)?instrucciones(?:\s+(?:anteriores|previas))?/gi,
  /new\s+instructions?:/gi,
  /nuevas?\s+instrucci(?:o|ó)n(?:es)?:/gi,
  /system\s*:/gi,
  /sistema\s*:/gi,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/g,
  /&#x?[0-9a-fA-F]+;/g,
];

// Categorías Unicode Cc (control) y Cf (formato: anchos cero, bidi U+202A-202E,
// U+2066-2069, guion suave U+00AD, BOM U+FEFF) más separadores de línea/párrafo.
const CONTROL_CC = new RegExp('[\\p{Cc}\\u2028\\u2029]', 'gu');
const FORMAT_CF = /\p{Cf}/gu;

/**
 * Normaliza y neutraliza un texto para el prompt.
 * - NFKC (ancho completo → ASCII, ligaduras, etc.)
 * - elimina Cf (invisibles) y sustituye Cc por espacio
 * - escapa `<` `>` y backticks; rompe secuencias `---`, `===`, `##`
 * - marca patrones de inyección conocidos con [FILTRADO]
 * - colapsa espacios y trunca por puntos de código
 *
 * @param {unknown} text
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeTextField(text, maxLen = 500) {
  if (text === null || text === undefined) return '';
  if (typeof text !== 'string') {
    if (typeof text === 'number' || typeof text === 'boolean') text = String(text);
    else return '';
  }
  if (maxLen <= 0) return '';

  let s = text.normalize('NFKC');
  s = s.replace(FORMAT_CF, '');
  s = s.replace(CONTROL_CC, ' ');
  // Caracteres estructurales del prompt: no pueden abrir/cerrar etiquetas ni bloques de código
  s = s.replace(/</g, '‹').replace(/>/g, '›').replace(/`/g, "'");
  // Separadores de sección y encabezados markdown falsos
  s = s.replace(/-{3,}/g, '—').replace(/={3,}/g, '=').replace(/#{2,}/g, '#');
  for (const pattern of INJECTION_PATTERNS) s = s.replace(pattern, '[FILTRADO]');
  s = s.replace(/\s+/g, ' ').trim();

  const chars = Array.from(s);
  if (chars.length > maxLen) s = chars.slice(0, maxLen).join('').trim();
  return s;
}

/**
 * Devuelve true si el texto contiene algún patrón de la lista negra (telemetría).
 * @param {unknown} text
 */
function hasInjectionMarkers(text) {
  if (typeof text !== 'string') return false;
  const normalized = text.normalize('NFKC').replace(FORMAT_CF, '');
  return INJECTION_PATTERNS.some((p) => {
    p.lastIndex = 0;
    const hit = p.test(normalized);
    p.lastIndex = 0;
    return hit;
  });
}

module.exports = { sanitizeTextField, hasInjectionMarkers, INJECTION_PATTERNS };
