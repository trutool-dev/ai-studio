/**
 * Detección de alérgenos e ingredientes excluidos por dieta (SEC-28 / JB-01, SEC-37 / JB-05).
 *
 * Se usa para:
 *  - filtrar el plan de respaldo (sin alérgenos fijos),
 *  - comprobar la salida del LLM: una comida que contenga un ingrediente
 *    restringido se descarta.
 *
 * Es una comprobación por palabras clave (español + inglés básico), deliberadamente
 * conservadora: ante la duda se excluye la comida. Las listas deben revisarse con
 * un profesional (pendiente de validación clínica por Antonio).
 */

'use strict';

/** Quita tildes y pasa a minúsculas para comparar. */
function fold(text) {
  return String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Grupos de alérgenos → palabras clave (ya "plegadas": sin tildes, minúsculas)
const ALLERGEN_KEYWORDS = Object.freeze({
  nuts: ['fruto seco', 'frutos secos', 'nuez', 'nueces', 'almendra', 'avellana', 'anacardo', 'pistacho', 'pecana', 'macadamia', 'castana de caju', 'praline', 'nut', 'walnut', 'almond', 'hazelnut', 'cashew'],
  peanuts: ['cacahuete', 'cacahuetes', 'mani', 'peanut'],
  dairy: ['leche', 'lacteo', 'lacteos', 'yogur', 'yogurt', 'queso', 'mantequilla', 'nata', 'kefir', 'requeson', 'cuajada', 'suero de leche', 'whey', 'caseina', 'lactosa', 'milk', 'cheese', 'butter', 'cream', 'ghee', 'mozzarella', 'parmesano', 'ricotta'],
  gluten: ['gluten', 'trigo', 'avena', 'cebada', 'centeno', 'espelta', 'kamut', 'pan', 'pasta', 'cuscus', 'seitan', 'harina', 'galleta', 'bulgur', 'tostada', 'wheat', 'oat', 'barley', 'rye', 'bread'],
  eggs: ['huevo', 'huevos', 'clara de huevo', 'yema', 'tortilla francesa', 'tortilla de patata', 'mayonesa', 'egg'],
  fish: ['pescado', 'salmon', 'atun', 'merluza', 'bacalao', 'sardina', 'boqueron', 'caballa', 'trucha', 'lubina', 'dorada', 'anchoa', 'rape', 'fish', 'tuna'],
  shellfish: ['marisco', 'gamba', 'gambas', 'langostino', 'cigala', 'cangrejo', 'bogavante', 'langosta', 'shrimp', 'prawn', 'crab'],
  molluscs: ['molusco', 'mejillon', 'almeja', 'calamar', 'pulpo', 'sepia', 'ostra', 'berberecho', 'vieira'],
  soy: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'salsa de soja', 'soy'],
  sesame: ['sesamo', 'tahini', 'tahina', 'hummus', 'sesame'],
  celery: ['apio', 'celery'],
  mustard: ['mostaza', 'mustard'],
  sulphites: ['sulfito', 'vino', 'vinagre'],
  lupin: ['altramuz', 'altramuces', 'lupino'],
  meat: ['pollo', 'pavo', 'ternera', 'cerdo', 'jamon', 'carne', 'chorizo', 'lomo', 'cordero', 'conejo', 'bacon', 'beicon', 'salchicha', 'chicken', 'beef', 'pork', 'proteina magra'],
  honey: ['miel', 'honey'],
});

// Frases que contienen una palabra clave pero no el alérgeno (p. ej. "leche de avena" no es láctea).
const SAFE_PHRASES = Object.freeze({
  dairy: [/leche (vegetal|de (soja|avena|arroz|coco|almendras?))/g, /sin lactosa/g, /yogur (vegetal|de (soja|coco))/g, /mantequilla de cacahuete/g, /nata vegetal/g],
  gluten: [/sin gluten/g, /pan de arroz/g, /pasta de (arroz|lentejas|garbanzos)/g, /harina de (arroz|garbanzo|maiz)/g],
  nuts: [/nuez moscada/g, /coco/g],
});

// Nombre de la restricción guardada → grupos de alérgenos
const RESTRICTION_TO_GROUPS = [
  { match: ['fruto seco', 'frutos secos', 'nuez', 'nueces', 'almendra', 'avellana', 'nuts'], groups: ['nuts'] },
  { match: ['cacahuete', 'mani', 'peanut'], groups: ['peanuts', 'nuts'] },
  { match: ['lactosa', 'lacteo', 'leche', 'dairy', 'milk', 'lactose'], groups: ['dairy'] },
  { match: ['gluten', 'trigo', 'celiac', 'celiaco', 'celiaquia'], groups: ['gluten'] },
  { match: ['huevo', 'egg'], groups: ['eggs'] },
  { match: ['marisco', 'crustaceo', 'shellfish'], groups: ['shellfish', 'molluscs'] },
  { match: ['molusco'], groups: ['molluscs'] },
  { match: ['pescado', 'fish'], groups: ['fish'] },
  { match: ['soja', 'soy'], groups: ['soy'] },
  { match: ['sesamo', 'sesame'], groups: ['sesame'] },
  { match: ['apio', 'celery'], groups: ['celery'] },
  { match: ['mostaza', 'mustard'], groups: ['mustard'] },
  { match: ['sulfito'], groups: ['sulphites'] },
  { match: ['altramuz', 'lupin'], groups: ['lupin'] },
];

// Tipo de dieta → grupos excluidos
const DIET_EXCLUSIONS = Object.freeze({
  vegan: ['meat', 'fish', 'shellfish', 'molluscs', 'dairy', 'eggs', 'honey'],
  vegetarian: ['meat', 'fish', 'shellfish', 'molluscs'],
  gluten_free: ['gluten'],
  lactose_free: ['dairy'],
});

/**
 * Construye el conjunto de exclusiones a partir de restricciones y tipo de dieta.
 * Las restricciones que no se reconocen se usan como palabra clave literal.
 * @param {Array<{food_name: string}>} restrictions
 * @param {string|null|undefined} dietType
 * @returns {{ groups: Set<string>, literals: string[] }}
 */
function buildExclusions(restrictions = [], dietType = null) {
  const groups = new Set(DIET_EXCLUSIONS[dietType] || []);
  const literals = [];
  for (const r of restrictions || []) {
    const name = fold(r && r.food_name);
    if (!name) continue;
    const mapped = RESTRICTION_TO_GROUPS.filter((g) => g.match.some((m) => name.includes(m)));
    if (mapped.length > 0) mapped.forEach((g) => g.groups.forEach((x) => groups.add(x)));
    else literals.push(name);
  }
  return { groups, literals };
}

/** Escapa un literal para usarlo en una RegExp. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿El texto contiene la palabra clave como palabra completa (admite plural -s/-es)? */
function containsKeyword(text, keyword) {
  return new RegExp(`(^|[^a-z])${escapeRe(keyword)}(s|es)?($|[^a-z])`).test(text);
}

/**
 * Devuelve los grupos/literales restringidos que aparecen en el texto.
 * @param {string} text
 * @param {{ groups: Set<string>, literals: string[] }} exclusions
 * @returns {string[]}
 */
function findViolations(text, exclusions) {
  const base = fold(text);
  const hits = [];
  for (const group of exclusions.groups) {
    let t = base;
    for (const re of SAFE_PHRASES[group] || []) t = t.replace(re, ' ');
    if ((ALLERGEN_KEYWORDS[group] || []).some((k) => containsKeyword(t, k))) hits.push(group);
  }
  for (const lit of exclusions.literals) {
    if (lit.length >= 3 && base.includes(lit)) hits.push(lit);
  }
  return hits;
}

/**
 * Texto analizable de una sugerencia de comida (nombre, descripción, ingredientes).
 * @param {{ name?: string, description?: string, ingredients?: string[] }} meal
 */
function mealText(meal) {
  return [meal.name, meal.description, ...(Array.isArray(meal.ingredients) ? meal.ingredients : [])]
    .filter((x) => typeof x === 'string').join(' | ');
}

/**
 * Separa las comidas seguras de las que contienen algo restringido.
 * @returns {{ safe: object[], rejected: Array<{ meal: object, violations: string[] }> }}
 */
function partitionMeals(meals, exclusions) {
  const safe = [];
  const rejected = [];
  for (const meal of meals || []) {
    const violations = findViolations(mealText(meal), exclusions);
    if (violations.length > 0) rejected.push({ meal, violations });
    else safe.push(meal);
  }
  return { safe, rejected };
}

module.exports = {
  fold,
  ALLERGEN_KEYWORDS,
  DIET_EXCLUSIONS,
  buildExclusions,
  findViolations,
  mealText,
  partitionMeals,
};
