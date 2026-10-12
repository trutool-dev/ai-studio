/**
 * Seed script para poblar la base de datos con datos realistas de desarrollo.
 * Ejecutar con: npx ts-node seed.ts (desde projects/healthy/database/)
 * O desde backend: npx ts-node ../database/seed.ts
 *
 * Para importar el catálogo de ejercicios, ejecutar:
 * node projects/healthy/database/seedExercises.js
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────

/** Genera una fecha restando días a hoy */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Genera una fecha futura sumando días */
function daysAhead(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Genera una fecha aleatoria dentro de un rango de días pasados */
function randomDaysAgo(min: number, max: number): Date {
  const days = Math.floor(Math.random() * (max - min + 1)) + min;
  return daysAgo(days);
}

/** Elige elemento aleatorio de un array */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Genera número decimal aleatorio entre min y max con 2 decimales */
function randDecimal(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

/** Genera entero aleatorio entre min y max */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────
// DATOS: EJERCICIOS (20)
// ─────────────────────────────────────────────────────────────

const exercisesData = [
  // Pecho
  {
    name: 'Press de banca plano',
    muscle_group: 'chest',
    equipment_needed: 'barbell',
    difficulty: 'intermediate' as const,
    instructions: 'Tumbado en banco plano, agarra la barra a anchura de hombros. Baja controlando hasta el pecho y empuja hacia arriba sin bloquear los codos.',
    video_url: null,
  },
  {
    name: 'Flexiones',
    muscle_group: 'chest',
    equipment_needed: null,
    difficulty: 'beginner' as const,
    instructions: 'Apoya manos y pies en el suelo. Baja el pecho hasta casi tocar el suelo, empuja hasta extender los brazos. Mantén el cuerpo recto.',
    video_url: null,
  },
  {
    name: 'Aperturas con mancuernas',
    muscle_group: 'chest',
    equipment_needed: 'dumbbells',
    difficulty: 'intermediate' as const,
    instructions: 'Tumbado en banco, sostén mancuernas sobre el pecho. Baja los brazos en arco hacia los lados hasta sentir el estiramiento y cierra volviendo a la posición inicial.',
    video_url: null,
  },
  // Espalda
  {
    name: 'Dominadas',
    muscle_group: 'back',
    equipment_needed: 'pull-up bar',
    difficulty: 'intermediate' as const,
    instructions: 'Cuelga de la barra con agarre prono a anchura de hombros. Tira hacia arriba hasta que la barbilla supere la barra. Baja controlando.',
    video_url: null,
  },
  {
    name: 'Remo con barra',
    muscle_group: 'back',
    equipment_needed: 'barbell',
    difficulty: 'intermediate' as const,
    instructions: 'Inclínate hacia adelante con espalda recta. Tira de la barra hacia el abdomen, apretando los omóplatos. Controla el descenso.',
    video_url: null,
  },
  {
    name: 'Jalón al pecho en polea',
    muscle_group: 'back',
    equipment_needed: 'cable machine',
    difficulty: 'beginner' as const,
    instructions: 'Sentado en la máquina de jalón, tira de la barra hasta el pecho mientras llevas los codos hacia abajo y atrás. Vuelve lentamente.',
    video_url: null,
  },
  // Piernas
  {
    name: 'Sentadilla con barra',
    muscle_group: 'legs',
    equipment_needed: 'barbell',
    difficulty: 'intermediate' as const,
    instructions: 'Coloca la barra en los trapecios. Pies a anchura de hombros. Baja hasta que los muslos queden paralelos al suelo. Empuja hacia arriba.',
    video_url: null,
  },
  {
    name: 'Zancadas',
    muscle_group: 'legs',
    equipment_needed: null,
    difficulty: 'beginner' as const,
    instructions: 'Da un paso largo hacia adelante, baja la rodilla trasera casi hasta el suelo, vuelve a la posición inicial y alterna piernas.',
    video_url: null,
  },
  {
    name: 'Peso muerto convencional',
    muscle_group: 'legs',
    equipment_needed: 'barbell',
    difficulty: 'advanced' as const,
    instructions: 'Pies a anchura de caderas, agarra la barra. Mantén espalda neutral, extiende caderas y rodillas al mismo tiempo para levantarte. Controla el descenso.',
    video_url: null,
  },
  {
    name: 'Leg press',
    muscle_group: 'legs',
    equipment_needed: 'leg press machine',
    difficulty: 'beginner' as const,
    instructions: 'Siéntate en la máquina con pies a anchura de hombros. Empuja la plataforma hasta casi extender las piernas. Baja controlando.',
    video_url: null,
  },
  // Hombros
  {
    name: 'Press militar con mancuernas',
    muscle_group: 'shoulders',
    equipment_needed: 'dumbbells',
    difficulty: 'intermediate' as const,
    instructions: 'Sentado o de pie, sostén mancuernas a la altura de los hombros. Empuja hacia arriba hasta casi extender los brazos. Baja controlando.',
    video_url: null,
  },
  {
    name: 'Elevaciones laterales',
    muscle_group: 'shoulders',
    equipment_needed: 'dumbbells',
    difficulty: 'beginner' as const,
    instructions: 'De pie con mancuernas a los lados, eleva los brazos lateralmente hasta la altura de los hombros. Mantén codos ligeramente flexionados.',
    video_url: null,
  },
  // Bíceps
  {
    name: 'Curl de bíceps con barra',
    muscle_group: 'biceps',
    equipment_needed: 'barbell',
    difficulty: 'beginner' as const,
    instructions: 'De pie con la barra en agarre supino. Flexiona los codos llevando la barra hacia los hombros. Controla el descenso.',
    video_url: null,
  },
  {
    name: 'Curl martillo con mancuernas',
    muscle_group: 'biceps',
    equipment_needed: 'dumbbells',
    difficulty: 'beginner' as const,
    instructions: 'De pie, agarre neutro (pulgares apuntando al techo). Flexiona los codos alternando brazos. Controla el descenso.',
    video_url: null,
  },
  // Tríceps
  {
    name: 'Extensión de tríceps en polea',
    muscle_group: 'triceps',
    equipment_needed: 'cable machine',
    difficulty: 'beginner' as const,
    instructions: 'De pie frente a la polea alta, codos pegados al cuerpo. Extiende los brazos hacia abajo. Controla el retorno.',
    video_url: null,
  },
  {
    name: 'Fondos en paralelas',
    muscle_group: 'triceps',
    equipment_needed: 'parallel bars',
    difficulty: 'intermediate' as const,
    instructions: 'Apóyate en las barras paralelas. Baja flexionando los codos hasta 90°. Empuja hasta extender los brazos.',
    video_url: null,
  },
  // Core / Abdomen
  {
    name: 'Plancha',
    muscle_group: 'core',
    equipment_needed: null,
    difficulty: 'beginner' as const,
    instructions: 'Apóyate en antebrazos y pies. Mantén el cuerpo en línea recta desde cabeza hasta talones. Contrae el abdomen. Aguanta el tiempo indicado.',
    video_url: null,
  },
  {
    name: 'Crunch abdominal',
    muscle_group: 'core',
    equipment_needed: null,
    difficulty: 'beginner' as const,
    instructions: 'Tumbado boca arriba, rodillas flexionadas. Eleva los hombros del suelo contrayendo el abdomen. No tires del cuello.',
    video_url: null,
  },
  // Cardio
  {
    name: 'Burpees',
    muscle_group: 'full_body',
    equipment_needed: null,
    difficulty: 'intermediate' as const,
    instructions: 'Desde de pie, baja al suelo, haz una flexión, salta de pies hacia las manos y salta con los brazos al aire. Repite de forma continua.',
    video_url: null,
  },
  {
    name: 'Mountain climbers',
    muscle_group: 'full_body',
    equipment_needed: null,
    difficulty: 'intermediate' as const,
    instructions: 'En posición de plancha alta, alterna llevando cada rodilla hacia el pecho de forma rápida y continua.',
    video_url: null,
  },
];

// ─────────────────────────────────────────────────────────────
// DATOS: ALIMENTOS (200)
// ─────────────────────────────────────────────────────────────

const foodsData = [
  // Frutas (25)
  { name: 'Manzana', brand: null, calories_per_100g: 52, protein_per_100g: 0.26, carbs_per_100g: 13.81, fat_per_100g: 0.17 },
  { name: 'Plátano', brand: null, calories_per_100g: 89, protein_per_100g: 1.09, carbs_per_100g: 22.84, fat_per_100g: 0.33 },
  { name: 'Naranja', brand: null, calories_per_100g: 47, protein_per_100g: 0.94, carbs_per_100g: 11.75, fat_per_100g: 0.12 },
  { name: 'Fresa', brand: null, calories_per_100g: 32, protein_per_100g: 0.67, carbs_per_100g: 7.68, fat_per_100g: 0.30 },
  { name: 'Sandía', brand: null, calories_per_100g: 30, protein_per_100g: 0.61, carbs_per_100g: 7.55, fat_per_100g: 0.15 },
  { name: 'Uva', brand: null, calories_per_100g: 67, protein_per_100g: 0.63, carbs_per_100g: 17.15, fat_per_100g: 0.16 },
  { name: 'Mango', brand: null, calories_per_100g: 60, protein_per_100g: 0.82, carbs_per_100g: 14.98, fat_per_100g: 0.38 },
  { name: 'Kiwi', brand: null, calories_per_100g: 61, protein_per_100g: 1.14, carbs_per_100g: 14.66, fat_per_100g: 0.52 },
  { name: 'Piña', brand: null, calories_per_100g: 50, protein_per_100g: 0.54, carbs_per_100g: 13.12, fat_per_100g: 0.12 },
  { name: 'Melocotón', brand: null, calories_per_100g: 39, protein_per_100g: 0.91, carbs_per_100g: 9.54, fat_per_100g: 0.25 },
  { name: 'Pera', brand: null, calories_per_100g: 57, protein_per_100g: 0.36, carbs_per_100g: 15.23, fat_per_100g: 0.14 },
  { name: 'Cereza', brand: null, calories_per_100g: 50, protein_per_100g: 1.06, carbs_per_100g: 12.18, fat_per_100g: 0.30 },
  { name: 'Arándano', brand: null, calories_per_100g: 57, protein_per_100g: 0.74, carbs_per_100g: 14.49, fat_per_100g: 0.33 },
  { name: 'Frambuesa', brand: null, calories_per_100g: 52, protein_per_100g: 1.20, carbs_per_100g: 11.94, fat_per_100g: 0.65 },
  { name: 'Papaya', brand: null, calories_per_100g: 43, protein_per_100g: 0.47, carbs_per_100g: 10.82, fat_per_100g: 0.26 },
  { name: 'Melón', brand: null, calories_per_100g: 34, protein_per_100g: 0.84, carbs_per_100g: 8.16, fat_per_100g: 0.19 },
  { name: 'Ciruela', brand: null, calories_per_100g: 46, protein_per_100g: 0.70, carbs_per_100g: 11.42, fat_per_100g: 0.28 },
  { name: 'Limón', brand: null, calories_per_100g: 29, protein_per_100g: 1.10, carbs_per_100g: 9.32, fat_per_100g: 0.30 },
  { name: 'Mandarina', brand: null, calories_per_100g: 53, protein_per_100g: 0.81, carbs_per_100g: 13.34, fat_per_100g: 0.31 },
  { name: 'Higo', brand: null, calories_per_100g: 74, protein_per_100g: 0.75, carbs_per_100g: 19.18, fat_per_100g: 0.30 },
  { name: 'Granada', brand: null, calories_per_100g: 83, protein_per_100g: 1.67, carbs_per_100g: 18.70, fat_per_100g: 1.17 },
  { name: 'Coco (pulpa)', brand: null, calories_per_100g: 354, protein_per_100g: 3.33, carbs_per_100g: 15.23, fat_per_100g: 33.49 },
  { name: 'Aguacate', brand: null, calories_per_100g: 160, protein_per_100g: 2.00, carbs_per_100g: 8.53, fat_per_100g: 14.66 },
  { name: 'Pomelo', brand: null, calories_per_100g: 42, protein_per_100g: 0.77, carbs_per_100g: 10.66, fat_per_100g: 0.14 },
  { name: 'Albaricoque', brand: null, calories_per_100g: 48, protein_per_100g: 1.40, carbs_per_100g: 11.12, fat_per_100g: 0.39 },

  // Verduras (25)
  { name: 'Brócoli', brand: null, calories_per_100g: 34, protein_per_100g: 2.82, carbs_per_100g: 6.64, fat_per_100g: 0.37 },
  { name: 'Espinaca', brand: null, calories_per_100g: 23, protein_per_100g: 2.86, carbs_per_100g: 3.63, fat_per_100g: 0.39 },
  { name: 'Zanahoria', brand: null, calories_per_100g: 41, protein_per_100g: 0.93, carbs_per_100g: 9.58, fat_per_100g: 0.24 },
  { name: 'Tomate', brand: null, calories_per_100g: 18, protein_per_100g: 0.88, carbs_per_100g: 3.89, fat_per_100g: 0.20 },
  { name: 'Pepino', brand: null, calories_per_100g: 15, protein_per_100g: 0.65, carbs_per_100g: 3.63, fat_per_100g: 0.11 },
  { name: 'Lechuga', brand: null, calories_per_100g: 15, protein_per_100g: 1.36, carbs_per_100g: 2.87, fat_per_100g: 0.15 },
  { name: 'Pimiento rojo', brand: null, calories_per_100g: 31, protein_per_100g: 0.99, carbs_per_100g: 6.03, fat_per_100g: 0.30 },
  { name: 'Cebolla', brand: null, calories_per_100g: 40, protein_per_100g: 1.10, carbs_per_100g: 9.34, fat_per_100g: 0.10 },
  { name: 'Ajo', brand: null, calories_per_100g: 149, protein_per_100g: 6.36, carbs_per_100g: 33.06, fat_per_100g: 0.50 },
  { name: 'Calabacín', brand: null, calories_per_100g: 17, protein_per_100g: 1.21, carbs_per_100g: 3.11, fat_per_100g: 0.32 },
  { name: 'Berenjena', brand: null, calories_per_100g: 25, protein_per_100g: 0.98, carbs_per_100g: 5.88, fat_per_100g: 0.18 },
  { name: 'Coliflor', brand: null, calories_per_100g: 25, protein_per_100g: 1.92, carbs_per_100g: 4.97, fat_per_100g: 0.28 },
  { name: 'Col rizada (kale)', brand: null, calories_per_100g: 49, protein_per_100g: 4.28, carbs_per_100g: 8.75, fat_per_100g: 0.93 },
  { name: 'Guisantes', brand: null, calories_per_100g: 81, protein_per_100g: 5.42, carbs_per_100g: 14.45, fat_per_100g: 0.40 },
  { name: 'Edamame', brand: null, calories_per_100g: 121, protein_per_100g: 11.91, carbs_per_100g: 8.91, fat_per_100g: 5.20 },
  { name: 'Acelga', brand: null, calories_per_100g: 19, protein_per_100g: 1.80, carbs_per_100g: 3.74, fat_per_100g: 0.20 },
  { name: 'Judías verdes', brand: null, calories_per_100g: 31, protein_per_100g: 1.83, carbs_per_100g: 6.97, fat_per_100g: 0.22 },
  { name: 'Remolacha', brand: null, calories_per_100g: 43, protein_per_100g: 1.61, carbs_per_100g: 9.56, fat_per_100g: 0.17 },
  { name: 'Apio', brand: null, calories_per_100g: 16, protein_per_100g: 0.69, carbs_per_100g: 2.97, fat_per_100g: 0.17 },
  { name: 'Champiñón', brand: null, calories_per_100g: 22, protein_per_100g: 3.09, carbs_per_100g: 3.26, fat_per_100g: 0.34 },
  { name: 'Espárrago', brand: null, calories_per_100g: 20, protein_per_100g: 2.20, carbs_per_100g: 3.88, fat_per_100g: 0.12 },
  { name: 'Alcachofa', brand: null, calories_per_100g: 47, protein_per_100g: 3.27, carbs_per_100g: 10.51, fat_per_100g: 0.15 },
  { name: 'Puerro', brand: null, calories_per_100g: 61, protein_per_100g: 1.50, carbs_per_100g: 14.15, fat_per_100g: 0.30 },
  { name: 'Nabo', brand: null, calories_per_100g: 28, protein_per_100g: 0.90, carbs_per_100g: 6.43, fat_per_100g: 0.10 },
  { name: 'Rábano', brand: null, calories_per_100g: 16, protein_per_100g: 0.68, carbs_per_100g: 3.40, fat_per_100g: 0.10 },

  // Proteínas animales (30)
  { name: 'Pechuga de pollo a la plancha', brand: null, calories_per_100g: 165, protein_per_100g: 31.02, carbs_per_100g: 0.00, fat_per_100g: 3.57 },
  { name: 'Salmón fresco', brand: null, calories_per_100g: 208, protein_per_100g: 20.42, carbs_per_100g: 0.00, fat_per_100g: 13.42 },
  { name: 'Atún en lata (en agua)', brand: null, calories_per_100g: 116, protein_per_100g: 25.51, carbs_per_100g: 0.00, fat_per_100g: 0.82 },
  { name: 'Huevo entero', brand: null, calories_per_100g: 155, protein_per_100g: 12.56, carbs_per_100g: 1.12, fat_per_100g: 10.61 },
  { name: 'Clara de huevo', brand: null, calories_per_100g: 52, protein_per_100g: 10.90, carbs_per_100g: 0.73, fat_per_100g: 0.17 },
  { name: 'Ternera magra (solomillo)', brand: null, calories_per_100g: 158, protein_per_100g: 26.33, carbs_per_100g: 0.00, fat_per_100g: 5.41 },
  { name: 'Cerdo (lomo)', brand: null, calories_per_100g: 182, protein_per_100g: 27.32, carbs_per_100g: 0.00, fat_per_100g: 7.72 },
  { name: 'Pavo (pechuga)', brand: null, calories_per_100g: 135, protein_per_100g: 29.90, carbs_per_100g: 0.00, fat_per_100g: 1.08 },
  { name: 'Bacalao', brand: null, calories_per_100g: 82, protein_per_100g: 17.81, carbs_per_100g: 0.00, fat_per_100g: 0.67 },
  { name: 'Gambas', brand: null, calories_per_100g: 99, protein_per_100g: 20.91, carbs_per_100g: 0.27, fat_per_100g: 1.73 },
  { name: 'Pechuga de pollo cruda', brand: null, calories_per_100g: 120, protein_per_100g: 22.50, carbs_per_100g: 0.00, fat_per_100g: 2.62 },
  { name: 'Sardina en lata', brand: null, calories_per_100g: 191, protein_per_100g: 22.97, carbs_per_100g: 0.00, fat_per_100g: 10.45 },
  { name: 'Caballa al horno', brand: null, calories_per_100g: 205, protein_per_100g: 18.60, carbs_per_100g: 0.00, fat_per_100g: 13.89 },
  { name: 'Carne picada de ternera (5% grasa)', brand: null, calories_per_100g: 139, protein_per_100g: 21.41, carbs_per_100g: 0.00, fat_per_100g: 5.70 },
  { name: 'Muslo de pollo sin piel', brand: null, calories_per_100g: 177, protein_per_100g: 24.99, carbs_per_100g: 0.00, fat_per_100g: 8.21 },
  { name: 'Trucha al vapor', brand: null, calories_per_100g: 149, protein_per_100g: 22.00, carbs_per_100g: 0.00, fat_per_100g: 6.18 },
  { name: 'Mejillones cocidos', brand: null, calories_per_100g: 86, protein_per_100g: 11.90, carbs_per_100g: 3.69, fat_per_100g: 2.24 },
  { name: 'Cangrejo cocido', brand: null, calories_per_100g: 97, protein_per_100g: 19.35, carbs_per_100g: 0.04, fat_per_100g: 1.54 },
  { name: 'Conejo (filete)', brand: null, calories_per_100g: 136, protein_per_100g: 20.05, carbs_per_100g: 0.00, fat_per_100g: 5.55 },
  { name: 'Cordero magro', brand: null, calories_per_100g: 258, protein_per_100g: 25.60, carbs_per_100g: 0.00, fat_per_100g: 16.57 },
  { name: 'Jamón serrano (sin grasa)', brand: null, calories_per_100g: 243, protein_per_100g: 30.30, carbs_per_100g: 0.30, fat_per_100g: 13.40 },
  { name: 'Pechuga de pavo en lonchas', brand: null, calories_per_100g: 107, protein_per_100g: 21.00, carbs_per_100g: 2.00, fat_per_100g: 1.10 },
  { name: 'Dorada al horno', brand: null, calories_per_100g: 128, protein_per_100g: 20.00, carbs_per_100g: 0.00, fat_per_100g: 5.00 },
  { name: 'Lubina al vapor', brand: null, calories_per_100g: 97, protein_per_100g: 18.43, carbs_per_100g: 0.00, fat_per_100g: 2.00 },
  { name: 'Langostinos cocidos', brand: null, calories_per_100g: 90, protein_per_100g: 18.80, carbs_per_100g: 0.50, fat_per_100g: 1.20 },
  { name: 'Sepia a la plancha', brand: null, calories_per_100g: 79, protein_per_100g: 16.24, carbs_per_100g: 0.84, fat_per_100g: 0.70 },
  { name: 'Pulpo cocido', brand: null, calories_per_100g: 82, protein_per_100g: 14.91, carbs_per_100g: 2.20, fat_per_100g: 1.04 },
  { name: 'Ventresca de atún', brand: null, calories_per_100g: 193, protein_per_100g: 23.33, carbs_per_100g: 0.00, fat_per_100g: 10.90 },
  { name: 'Pato (pechuga)', brand: null, calories_per_100g: 201, protein_per_100g: 23.48, carbs_per_100g: 0.00, fat_per_100g: 11.24 },
  { name: 'Tortilla francesa', brand: null, calories_per_100g: 154, protein_per_100g: 10.57, carbs_per_100g: 1.29, fat_per_100g: 11.66 },

  // Carbohidratos / Cereales (30)
  { name: 'Arroz blanco cocido', brand: null, calories_per_100g: 130, protein_per_100g: 2.69, carbs_per_100g: 28.17, fat_per_100g: 0.28 },
  { name: 'Arroz integral cocido', brand: null, calories_per_100g: 112, protein_per_100g: 2.56, carbs_per_100g: 23.51, fat_per_100g: 0.83 },
  { name: 'Pasta cocida', brand: null, calories_per_100g: 158, protein_per_100g: 5.76, carbs_per_100g: 30.86, fat_per_100g: 0.93 },
  { name: 'Pan integral', brand: null, calories_per_100g: 247, protein_per_100g: 12.45, carbs_per_100g: 41.30, fat_per_100g: 3.50 },
  { name: 'Pan blanco', brand: null, calories_per_100g: 265, protein_per_100g: 9.00, carbs_per_100g: 49.00, fat_per_100g: 3.20 },
  { name: 'Avena (cruda)', brand: null, calories_per_100g: 389, protein_per_100g: 16.89, carbs_per_100g: 66.27, fat_per_100g: 6.90 },
  { name: 'Quinoa cocida', brand: null, calories_per_100g: 120, protein_per_100g: 4.40, carbs_per_100g: 21.30, fat_per_100g: 1.92 },
  { name: 'Patata cocida', brand: null, calories_per_100g: 77, protein_per_100g: 2.02, carbs_per_100g: 17.49, fat_per_100g: 0.09 },
  { name: 'Boniato al horno', brand: null, calories_per_100g: 90, protein_per_100g: 2.01, carbs_per_100g: 20.71, fat_per_100g: 0.15 },
  { name: 'Lentejas cocidas', brand: null, calories_per_100g: 116, protein_per_100g: 9.02, carbs_per_100g: 20.13, fat_per_100g: 0.38 },
  { name: 'Garbanzos cocidos', brand: null, calories_per_100g: 164, protein_per_100g: 8.86, carbs_per_100g: 27.42, fat_per_100g: 2.59 },
  { name: 'Alubias negras cocidas', brand: null, calories_per_100g: 132, protein_per_100g: 8.86, carbs_per_100g: 23.71, fat_per_100g: 0.54 },
  { name: 'Tortita de arroz', brand: null, calories_per_100g: 387, protein_per_100g: 7.50, carbs_per_100g: 81.50, fat_per_100g: 2.60 },
  { name: 'Muesli (sin azúcar)', brand: null, calories_per_100g: 368, protein_per_100g: 10.00, carbs_per_100g: 60.00, fat_per_100g: 8.00 },
  { name: 'Copos de maíz', brand: null, calories_per_100g: 357, protein_per_100g: 7.50, carbs_per_100g: 84.00, fat_per_100g: 0.40 },
  { name: 'Harina de avena', brand: null, calories_per_100g: 379, protein_per_100g: 13.15, carbs_per_100g: 67.70, fat_per_100g: 6.52 },
  { name: 'Pasta integral cocida', brand: null, calories_per_100g: 148, protein_per_100g: 5.43, carbs_per_100g: 29.54, fat_per_100g: 1.06 },
  { name: 'Cuscús cocido', brand: null, calories_per_100g: 112, protein_per_100g: 3.79, carbs_per_100g: 23.22, fat_per_100g: 0.16 },
  { name: 'Bulgur cocido', brand: null, calories_per_100g: 83, protein_per_100g: 3.08, carbs_per_100g: 18.58, fat_per_100g: 0.24 },
  { name: 'Polenta cocida', brand: null, calories_per_100g: 70, protein_per_100g: 1.68, carbs_per_100g: 15.18, fat_per_100g: 0.35 },
  { name: 'Amaranto cocido', brand: null, calories_per_100g: 102, protein_per_100g: 3.84, carbs_per_100g: 18.69, fat_per_100g: 1.58 },
  { name: 'Mijo cocido', brand: null, calories_per_100g: 119, protein_per_100g: 3.51, carbs_per_100g: 23.67, fat_per_100g: 1.00 },
  { name: 'Sarraceno cocido', brand: null, calories_per_100g: 92, protein_per_100g: 3.38, carbs_per_100g: 19.94, fat_per_100g: 0.62 },
  { name: 'Pan de centeno', brand: null, calories_per_100g: 259, protein_per_100g: 8.50, carbs_per_100g: 48.30, fat_per_100g: 3.30 },
  { name: 'Galleta de avena', brand: null, calories_per_100g: 388, protein_per_100g: 6.10, carbs_per_100g: 72.40, fat_per_100g: 9.60 },
  { name: 'Patata al vapor', brand: null, calories_per_100g: 80, protein_per_100g: 1.89, carbs_per_100g: 18.43, fat_per_100g: 0.09 },
  { name: 'Yuca cocida', brand: null, calories_per_100g: 112, protein_per_100g: 0.88, carbs_per_100g: 26.78, fat_per_100g: 0.28 },
  { name: 'Espaguetis integrales cocidos', brand: null, calories_per_100g: 152, protein_per_100g: 6.00, carbs_per_100g: 29.00, fat_per_100g: 1.30 },
  { name: 'Tortilla de maíz', brand: null, calories_per_100g: 218, protein_per_100g: 5.70, carbs_per_100g: 45.90, fat_per_100g: 2.50 },
  { name: 'Pan de pita integral', brand: null, calories_per_100g: 275, protein_per_100g: 9.10, carbs_per_100g: 55.70, fat_per_100g: 1.20 },

  // Lácteos y derivados (20)
  { name: 'Leche entera', brand: null, calories_per_100g: 61, protein_per_100g: 3.15, carbs_per_100g: 4.80, fat_per_100g: 3.25 },
  { name: 'Leche desnatada', brand: null, calories_per_100g: 34, protein_per_100g: 3.37, carbs_per_100g: 4.96, fat_per_100g: 0.08 },
  { name: 'Yogur natural (0%)', brand: null, calories_per_100g: 56, protein_per_100g: 10.19, carbs_per_100g: 3.60, fat_per_100g: 0.39 },
  { name: 'Yogur griego entero', brand: null, calories_per_100g: 115, protein_per_100g: 10.00, carbs_per_100g: 3.98, fat_per_100g: 5.00 },
  { name: 'Queso fresco Burgos', brand: null, calories_per_100g: 174, protein_per_100g: 14.30, carbs_per_100g: 2.80, fat_per_100g: 11.90 },
  { name: 'Queso cottage', brand: null, calories_per_100g: 98, protein_per_100g: 11.12, carbs_per_100g: 3.38, fat_per_100g: 4.30 },
  { name: 'Queso mozzarella light', brand: null, calories_per_100g: 254, protein_per_100g: 27.47, carbs_per_100g: 2.19, fat_per_100g: 15.92 },
  { name: 'Requesón', brand: null, calories_per_100g: 128, protein_per_100g: 10.00, carbs_per_100g: 4.60, fat_per_100g: 8.30 },
  { name: 'Kéfir natural', brand: null, calories_per_100g: 64, protein_per_100g: 3.79, carbs_per_100g: 4.48, fat_per_100g: 3.25 },
  { name: 'Leche de almendra (sin azúcar)', brand: null, calories_per_100g: 17, protein_per_100g: 0.59, carbs_per_100g: 0.28, fat_per_100g: 1.44 },
  { name: 'Leche de avena', brand: null, calories_per_100g: 46, protein_per_100g: 1.00, carbs_per_100g: 9.00, fat_per_100g: 0.50 },
  { name: 'Bebida de soja (sin azúcar)', brand: null, calories_per_100g: 33, protein_per_100g: 3.27, carbs_per_100g: 1.75, fat_per_100g: 1.73 },
  { name: 'Queso parmesano', brand: null, calories_per_100g: 431, protein_per_100g: 38.50, carbs_per_100g: 3.22, fat_per_100g: 28.61 },
  { name: 'Mantequilla', brand: null, calories_per_100g: 717, protein_per_100g: 0.85, carbs_per_100g: 0.06, fat_per_100g: 81.11 },
  { name: 'Nata para cocinar (18%)', brand: null, calories_per_100g: 182, protein_per_100g: 2.70, carbs_per_100g: 3.58, fat_per_100g: 18.18 },
  { name: 'Yogur de frutas (bajo en grasa)', brand: null, calories_per_100g: 94, protein_per_100g: 3.60, carbs_per_100g: 17.90, fat_per_100g: 1.00 },
  { name: 'Queso gouda laminado', brand: null, calories_per_100g: 356, protein_per_100g: 24.94, carbs_per_100g: 2.22, fat_per_100g: 27.44 },
  { name: 'Helado de vainilla', brand: null, calories_per_100g: 207, protein_per_100g: 3.50, carbs_per_100g: 23.60, fat_per_100g: 11.00 },
  { name: 'Batido de proteína de suero (whey)', brand: null, calories_per_100g: 372, protein_per_100g: 78.00, carbs_per_100g: 7.00, fat_per_100g: 4.00 },
  { name: 'Caseína (proteína lenta)', brand: null, calories_per_100g: 360, protein_per_100g: 75.00, carbs_per_100g: 9.00, fat_per_100g: 2.00 },

  // Grasas saludables y frutos secos (20)
  { name: 'Aceite de oliva virgen extra', brand: null, calories_per_100g: 884, protein_per_100g: 0.00, carbs_per_100g: 0.00, fat_per_100g: 100.00 },
  { name: 'Almendras', brand: null, calories_per_100g: 579, protein_per_100g: 21.15, carbs_per_100g: 21.55, fat_per_100g: 49.93 },
  { name: 'Nuez', brand: null, calories_per_100g: 654, protein_per_100g: 15.23, carbs_per_100g: 13.71, fat_per_100g: 65.21 },
  { name: 'Anacardo', brand: null, calories_per_100g: 553, protein_per_100g: 18.22, carbs_per_100g: 30.19, fat_per_100g: 43.85 },
  { name: 'Pistachos', brand: null, calories_per_100g: 562, protein_per_100g: 20.27, carbs_per_100g: 27.97, fat_per_100g: 45.39 },
  { name: 'Avellanas', brand: null, calories_per_100g: 628, protein_per_100g: 14.95, carbs_per_100g: 16.70, fat_per_100g: 60.75 },
  { name: 'Mantequilla de cacahuete (natural)', brand: null, calories_per_100g: 598, protein_per_100g: 22.21, carbs_per_100g: 20.09, fat_per_100g: 51.36 },
  { name: 'Semillas de chía', brand: null, calories_per_100g: 486, protein_per_100g: 16.54, carbs_per_100g: 42.12, fat_per_100g: 30.74 },
  { name: 'Semillas de lino', brand: null, calories_per_100g: 534, protein_per_100g: 18.29, carbs_per_100g: 28.88, fat_per_100g: 42.16 },
  { name: 'Semillas de calabaza', brand: null, calories_per_100g: 559, protein_per_100g: 30.23, carbs_per_100g: 10.71, fat_per_100g: 49.05 },
  { name: 'Semillas de girasol', brand: null, calories_per_100g: 584, protein_per_100g: 20.78, carbs_per_100g: 20.00, fat_per_100g: 51.46 },
  { name: 'Aceite de coco virgen', brand: null, calories_per_100g: 862, protein_per_100g: 0.00, carbs_per_100g: 0.00, fat_per_100g: 100.00 },
  { name: 'Tahini (pasta de sésamo)', brand: null, calories_per_100g: 595, protein_per_100g: 17.00, carbs_per_100g: 21.19, fat_per_100g: 53.76 },
  { name: 'Aceite de aguacate', brand: null, calories_per_100g: 884, protein_per_100g: 0.00, carbs_per_100g: 0.00, fat_per_100g: 100.00 },
  { name: 'Piñones', brand: null, calories_per_100g: 673, protein_per_100g: 13.69, carbs_per_100g: 13.08, fat_per_100g: 68.37 },
  { name: 'Cacahuetes tostados', brand: null, calories_per_100g: 585, protein_per_100g: 23.68, carbs_per_100g: 21.51, fat_per_100g: 49.66 },
  { name: 'Nuez de macadamia', brand: null, calories_per_100g: 718, protein_per_100g: 7.91, carbs_per_100g: 13.82, fat_per_100g: 75.77 },
  { name: 'Mantequilla de almendra', brand: null, calories_per_100g: 614, protein_per_100g: 20.96, carbs_per_100g: 18.82, fat_per_100g: 55.50 },
  { name: 'Aceitunas negras', brand: null, calories_per_100g: 115, protein_per_100g: 0.84, carbs_per_100g: 6.26, fat_per_100g: 10.90 },
  { name: 'Aceitunas verdes', brand: null, calories_per_100g: 145, protein_per_100g: 1.03, carbs_per_100g: 3.84, fat_per_100g: 15.32 },

  // Snacks y otros (15)
  { name: 'Barritas de proteína (genérica)', brand: null, calories_per_100g: 390, protein_per_100g: 30.00, carbs_per_100g: 40.00, fat_per_100g: 10.00 },
  { name: 'Chocolate negro 85%', brand: null, calories_per_100g: 598, protein_per_100g: 12.50, carbs_per_100g: 28.49, fat_per_100g: 47.56 },
  { name: 'Chips de patata (light)', brand: null, calories_per_100g: 471, protein_per_100g: 6.56, carbs_per_100g: 63.00, fat_per_100g: 21.00 },
  { name: 'Palomitas de maíz (sin sal)', brand: null, calories_per_100g: 375, protein_per_100g: 11.66, carbs_per_100g: 74.33, fat_per_100g: 4.33 },
  { name: 'Hummus', brand: null, calories_per_100g: 177, protein_per_100g: 7.90, carbs_per_100g: 14.29, fat_per_100g: 9.60 },
  { name: 'Guacamole', brand: null, calories_per_100g: 155, protein_per_100g: 2.00, carbs_per_100g: 8.61, fat_per_100g: 14.16 },
  { name: 'Dátiles', brand: null, calories_per_100g: 277, protein_per_100g: 1.81, carbs_per_100g: 74.97, fat_per_100g: 0.15 },
  { name: 'Orejones (albaricoque seco)', brand: null, calories_per_100g: 241, protein_per_100g: 3.39, carbs_per_100g: 62.64, fat_per_100g: 0.51 },
  { name: 'Pasas', brand: null, calories_per_100g: 299, protein_per_100g: 3.07, carbs_per_100g: 79.18, fat_per_100g: 0.46 },
  { name: 'Granola casera', brand: null, calories_per_100g: 471, protein_per_100g: 10.26, carbs_per_100g: 64.06, fat_per_100g: 19.90 },
  { name: 'Tortitas de maíz (snack)', brand: null, calories_per_100g: 366, protein_per_100g: 8.00, carbs_per_100g: 76.00, fat_per_100g: 2.20 },
  { name: 'Nachos (sin sal)', brand: null, calories_per_100g: 477, protein_per_100g: 7.00, carbs_per_100g: 72.00, fat_per_100g: 18.00 },
  { name: 'Barrita de cereales', brand: null, calories_per_100g: 381, protein_per_100g: 6.00, carbs_per_100g: 69.00, fat_per_100g: 9.50 },
  { name: 'Cracker de espelta', brand: null, calories_per_100g: 423, protein_per_100g: 13.00, carbs_per_100g: 71.50, fat_per_100g: 8.80 },
  { name: 'Mix de frutos secos y pasas', brand: null, calories_per_100g: 527, protein_per_100g: 14.50, carbs_per_100g: 40.00, fat_per_100g: 33.00 },

  // Bebidas y otros (10)
  { name: 'Agua mineral', brand: null, calories_per_100g: 0, protein_per_100g: 0.00, carbs_per_100g: 0.00, fat_per_100g: 0.00 },
  { name: 'Zumo de naranja natural', brand: null, calories_per_100g: 45, protein_per_100g: 0.70, carbs_per_100g: 10.40, fat_per_100g: 0.20 },
  { name: 'Café negro (sin azúcar)', brand: null, calories_per_100g: 2, protein_per_100g: 0.28, carbs_per_100g: 0.00, fat_per_100g: 0.00 },
  { name: 'Té verde', brand: null, calories_per_100g: 1, protein_per_100g: 0.22, carbs_per_100g: 0.00, fat_per_100g: 0.00 },
  { name: 'Leche de coco (para cocinar)', brand: null, calories_per_100g: 230, protein_per_100g: 2.29, carbs_per_100g: 5.54, fat_per_100g: 23.84 },
  { name: 'Zumo de manzana natural', brand: null, calories_per_100g: 46, protein_per_100g: 0.10, carbs_per_100g: 11.30, fat_per_100g: 0.10 },
  { name: 'Batido de proteína de chocolate', brand: null, calories_per_100g: 380, protein_per_100g: 74.00, carbs_per_100g: 12.00, fat_per_100g: 5.00 },
  { name: 'Caldo de pollo casero', brand: null, calories_per_100g: 15, protein_per_100g: 1.50, carbs_per_100g: 1.00, fat_per_100g: 0.50 },
  { name: 'Zumo de tomate', brand: null, calories_per_100g: 17, protein_per_100g: 0.85, carbs_per_100g: 3.53, fat_per_100g: 0.06 },
  { name: 'Kombucha natural', brand: null, calories_per_100g: 13, protein_per_100g: 0.00, carbs_per_100g: 3.00, fat_per_100g: 0.00 },
];

// ─────────────────────────────────────────────────────────────
// DATOS BASE DE USUARIOS (10)
// ─────────────────────────────────────────────────────────────

interface UserSeedData {
  name: string;
  email: string;
  birthdate: Date;
  gender: string;
  weight_kg: number;
  height_cm: number;
  goal: 'lose_weight' | 'gain_muscle' | 'maintain' | 'general_health';
  activity_level: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  experience: 'beginner' | 'intermediate' | 'advanced';
}

const usersBaseData: UserSeedData[] = [
  { name: 'Ana García López', email: 'ana.garcia@example.com', birthdate: new Date('1992-03-15'), gender: 'female', weight_kg: 68.5, height_cm: 165.0, goal: 'lose_weight', activity_level: 'moderate', experience: 'beginner' },
  { name: 'Carlos Martínez Pérez', email: 'carlos.martinez@example.com', birthdate: new Date('1988-07-22'), gender: 'male', weight_kg: 85.0, height_cm: 178.0, goal: 'gain_muscle', activity_level: 'active', experience: 'intermediate' },
  { name: 'Laura Sánchez Ruiz', email: 'laura.sanchez@example.com', birthdate: new Date('1995-11-08'), gender: 'female', weight_kg: 58.0, height_cm: 162.0, goal: 'maintain', activity_level: 'light', experience: 'beginner' },
  { name: 'David Fernández Torres', email: 'david.fernandez@example.com', birthdate: new Date('1985-01-30'), gender: 'male', weight_kg: 92.0, height_cm: 182.0, goal: 'lose_weight', activity_level: 'sedentary', experience: 'beginner' },
  { name: 'Sofía Rodríguez Navarro', email: 'sofia.rodriguez@example.com', birthdate: new Date('1998-05-14'), gender: 'female', weight_kg: 62.0, height_cm: 168.0, goal: 'gain_muscle', activity_level: 'active', experience: 'intermediate' },
  { name: 'Miguel Jiménez Castro', email: 'miguel.jimenez@example.com', birthdate: new Date('1990-09-03'), gender: 'male', weight_kg: 78.0, height_cm: 175.0, goal: 'general_health', activity_level: 'moderate', experience: 'intermediate' },
  { name: 'Elena Díaz Morales', email: 'elena.diaz@example.com', birthdate: new Date('1993-12-19'), gender: 'female', weight_kg: 71.0, height_cm: 170.0, goal: 'lose_weight', activity_level: 'light', experience: 'beginner' },
  { name: 'Pablo González Herrero', email: 'pablo.gonzalez@example.com', birthdate: new Date('1987-04-25'), gender: 'male', weight_kg: 88.5, height_cm: 180.0, goal: 'gain_muscle', activity_level: 'very_active', experience: 'advanced' },
  { name: 'Carmen López Serrano', email: 'carmen.lopez@example.com', birthdate: new Date('1996-08-11'), gender: 'female', weight_kg: 55.0, height_cm: 158.0, goal: 'general_health', activity_level: 'moderate', experience: 'beginner' },
  { name: 'Alejandro Pérez Vega', email: 'alejandro.perez@example.com', birthdate: new Date('1991-02-07'), gender: 'male', weight_kg: 80.0, height_cm: 177.0, goal: 'maintain', activity_level: 'active', experience: 'advanced' },
];

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('Iniciando seed de la base de datos Healthy...\n');

  // 1. LIMPIAR BASE DE DATOS (en orden inverso por FK)
  console.log('Limpiando datos existentes...');
  await prisma.dailyLog.deleteMany();
  await prisma.progressLog.deleteMany();
  await prisma.mealFood.deleteMany();
  await prisma.meal.deleteMany();
  await prisma.sessionExercise.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.food.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.onboardingAnswer.deleteMany();
  await prisma.motivationProfile.deleteMany();
  await prisma.foodRestriction.deleteMany();
  await prisma.nutritionPreferences.deleteMany();
  await prisma.healthCondition.deleteMany();
  await prisma.trainingPreferences.deleteMany();
  await prisma.lifestyleProfile.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.verificationCode.deleteMany();
  await prisma.user.deleteMany();
  console.log('Base de datos limpiada.\n');

  // 2. CREAR EJERCICIOS (20)
  console.log('Creando ejercicios...');
  const exercises = await Promise.all(
    exercisesData.map(e => prisma.exercise.create({ data: e }))
  );
  console.log(`  ${exercises.length} ejercicios creados.\n`);

  // 3. CREAR ALIMENTOS (200)
  console.log('Creando alimentos...');
  const foods = await Promise.all(
    foodsData.map(f => prisma.food.create({
      data: {
        ...f,
        calories_per_100g: f.calories_per_100g,
        protein_per_100g: f.protein_per_100g,
        carbs_per_100g: f.carbs_per_100g,
        fat_per_100g: f.fat_per_100g,
        verified: true,
      }
    }))
  );
  console.log(`  ${foods.length} alimentos creados.\n`);

  // 4. CREAR USUARIOS CON PERFILES COMPLETOS (10)
  console.log('Creando usuarios con perfiles completos...');
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  const createdUsers = [];
  for (const userData of usersBaseData) {
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        password_hash: passwordHash,
        email_verified: true,
        phone_verified: false,
        status: 'active',
        // Perfil físico
        profile: {
          create: {
            name: userData.name,
            birthdate: userData.birthdate,
            gender: userData.gender,
            weight_kg: userData.weight_kg,
            height_cm: userData.height_cm,
            body_type: pick(['ectomorph', 'mesomorph', 'endomorph'] as const),
            activity_level: userData.activity_level,
            goal: userData.goal,
            daily_calories_target: randInt(1600, 2800),
            daily_protein_target: randInt(100, 200),
            daily_carbs_target: randInt(150, 350),
            daily_fat_target: randInt(50, 90),
          }
        },
        // Perfil de estilo de vida
        lifestyle_profile: {
          create: {
            profession: pick(['Ingeniero/a', 'Médico/a', 'Estudiante', 'Administrativo/a', 'Comercial', 'Diseñador/a', 'Profesor/a', 'Enfermero/a']),
            work_type: pick(['office', 'physical', 'standing', 'mixed'] as const),
            work_hours_per_day: randInt(6, 10),
            stress_level: randInt(1, 5),
            usual_schedule: pick(['morning', 'afternoon', 'night'] as const),
            sleep_hours_usual: randDecimal(5.5, 9.0),
            sleep_quality: pick(['good', 'regular', 'bad'] as const),
            alcohol_consumption: pick(['never', 'occasional', 'frequent'] as const),
            smoker: Math.random() < 0.15,
            daily_water_glasses: randInt(4, 10),
          }
        },
        // Preferencias de entrenamiento
        training_preferences: {
          create: {
            available_days_per_week: randInt(2, 6),
            max_session_duration_minutes: pick([30, 45, 60, 75, 90]),
            preferred_training_time: pick(['morning', 'afternoon', 'night'] as const),
            has_gym_access: Math.random() < 0.65,
            home_equipment: pick(['none', 'dumbbells', 'bands', 'machines', 'full'] as const),
            experience_level: userData.experience,
          }
        },
        // Preferencias nutricionales
        nutrition_preferences: {
          create: {
            diet_type: pick(['omnivore', 'vegetarian', 'vegan', 'gluten_free', 'lactose_free'] as const),
            meals_per_day_preferred: randInt(3, 6),
            cooks_at_home: Math.random() < 0.7,
            eats_out_frequency: pick(['never', 'sometimes', 'often', 'always'] as const),
            monthly_food_budget_range: pick(['low', 'medium', 'high'] as const),
          }
        },
        // Perfil de motivación
        motivation_profile: {
          create: {
            main_motivation: pick(['health', 'aesthetics', 'performance', 'mental_wellbeing'] as const),
            previous_attempts: Math.random() < 0.6,
            tracking_preference: pick(['detailed', 'basic', 'results_only'] as const),
            has_support_network: Math.random() < 0.5,
          }
        },
      }
    });
    createdUsers.push(user);
  }
  console.log(`  ${createdUsers.length} usuarios creados con perfiles completos.\n`);

  // 5. CREAR 5 PLANES DE ENTRENAMIENTO (variantes fuerza/cardio/híbrido)
  console.log('Creando planes de entrenamiento...');

  const planConfigs = [
    { userIndex: 0, type: 'training' as const, name: 'Fuerza Básica 3 semanas', weeks: 3, style: 'strength' },
    { userIndex: 1, type: 'training' as const, name: 'Cardio Intensivo 3 semanas', weeks: 3, style: 'cardio' },
    { userIndex: 2, type: 'combined' as const, name: 'Híbrido Fuerza-Cardio 3 semanas', weeks: 3, style: 'hybrid' },
    { userIndex: 3, type: 'training' as const, name: 'Volumen Muscular Avanzado 3 semanas', weeks: 3, style: 'strength' },
    { userIndex: 4, type: 'nutrition' as const, name: 'Plan Nutricional Déficit 3 semanas', weeks: 3, style: 'nutrition' },
  ];

  const createdPlans = [];
  for (const config of planConfigs) {
    const plan = await prisma.plan.create({
      data: {
        user_id: createdUsers[config.userIndex].id,
        type: config.type,
        start_date: daysAgo(21),
        end_date: daysAhead(0),
        status: 'active',
        generated_by_ai: true,
        ai_model_version: 'claude-sonnet-4-6',
        ai_prompt_used: `Genera un plan de ${config.style} para 3 semanas adaptado al perfil del usuario`,
      }
    });
    createdPlans.push({ plan, config });
  }
  console.log(`  ${createdPlans.length} planes creados.\n`);

  // 6. CREAR SESIONES DE ENTRENAMIENTO — para 3 usuarios (últimos 30 días)
  console.log('Creando historial de sesiones de entrenamiento...');

  // Ejercicios por tipo de plan
  const strengthExercises = exercises.filter(e =>
    ['chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps'].includes(e.muscle_group)
  );
  const cardioExercises = exercises.filter(e => e.muscle_group === 'full_body');
  const coreExercises = exercises.filter(e => e.muscle_group === 'core');

  let totalSessions = 0;
  // Los primeros 3 planes tienen training sessions
  for (const { plan, config } of createdPlans.slice(0, 3)) {
    if (config.type === 'nutrition') continue;

    const sessionsPerWeek = config.style === 'cardio' ? 4 : config.style === 'hybrid' ? 3 : 4;
    const totalDays = 21;
    const exercisePool = config.style === 'cardio'
      ? [...cardioExercises, ...coreExercises]
      : config.style === 'hybrid'
        ? [...strengthExercises.slice(0, 6), ...cardioExercises]
        : strengthExercises;

    for (let day = 21; day >= 0; day--) {
      // Simular días de entrenamiento (no todos los días)
      const isTrainingDay = (21 - day) % Math.floor(7 / sessionsPerWeek) === 0;
      if (!isTrainingDay) continue;

      const isCompleted = day > 1; // las últimas sesiones están completadas
      const sessionDate = daysAgo(day);

      const session = await prisma.trainingSession.create({
        data: {
          plan_id: plan.id,
          user_id: createdUsers[config.userIndex].id,
          scheduled_date: sessionDate,
          completed_at: isCompleted ? sessionDate : null,
          duration_minutes: isCompleted ? randInt(35, 75) : null,
          calories_burned: isCompleted ? randInt(200, 500) : null,
          notes: isCompleted ? pick(['Sesión completada con energía', 'Me costó el final pero bien', 'Superé mis marcas de hoy', 'Cansado pero constante', null]) : null,
          status: isCompleted ? 'completed' : 'scheduled',
        }
      });

      // Añadir ejercicios a la sesión (entre 4 y 6 ejercicios)
      const numExercises = randInt(4, 6);
      const sessionExercises = exercisePool.slice(0, numExercises);

      for (let i = 0; i < sessionExercises.length; i++) {
        const ex = sessionExercises[i];
        await prisma.sessionExercise.create({
          data: {
            session_id: session.id,
            exercise_id: ex.id,
            sets: randInt(3, 5),
            reps: config.style === 'cardio' ? randInt(12, 20) : randInt(6, 12),
            weight_kg: ['core', 'full_body'].includes(ex.muscle_group) ? null : randDecimal(10, 60),
            rest_seconds: config.style === 'cardio' ? randInt(30, 60) : randInt(60, 120),
            order_index: i + 1,
            completed: isCompleted,
          }
        });
      }
      totalSessions++;
    }
  }
  console.log(`  ${totalSessions} sesiones de entrenamiento creadas.\n`);

  // 7. REGISTROS DE PROGRESO — 30 días para los primeros 3 usuarios
  console.log('Creando registros de progreso...');

  const progressConfigs = [
    { userIndex: 0, startWeight: 68.5, weightDelta: -0.15 }, // perdiendo peso
    { userIndex: 1, startWeight: 85.0, weightDelta: 0.05 },  // ganando músculo
    { userIndex: 2, startWeight: 58.0, weightDelta: 0.00 },  // mantenimiento
  ];

  let totalProgressLogs = 0;
  for (const pc of progressConfigs) {
    for (let day = 30; day >= 0; day--) {
      // No todos los días (registra cada 3-4 días aprox)
      if (day % randInt(3, 5) !== 0 && day !== 0) continue;

      const currentWeight = pc.startWeight + pc.weightDelta * (30 - day);
      await prisma.progressLog.create({
        data: {
          user_id: createdUsers[pc.userIndex].id,
          log_date: daysAgo(day),
          weight_kg: parseFloat(currentWeight.toFixed(1)),
          body_fat_percentage: randDecimal(15.0, 28.0),
          muscle_mass_kg: randDecimal(30.0, 50.0),
          waist_cm: randDecimal(70.0, 95.0),
          hip_cm: randDecimal(85.0, 110.0),
          chest_cm: randDecimal(85.0, 110.0),
          notes: pick(['Todo bien, progresando', 'Semana dura pero constante', 'Mucha retención de agua', null, null]),
        }
      });
      totalProgressLogs++;
    }
  }
  console.log(`  ${totalProgressLogs} registros de progreso creados.\n`);

  // 8. DAILY LOGS — 30 días para los primeros 3 usuarios
  console.log('Creando daily logs...');
  let totalDailyLogs = 0;
  for (let userIndex = 0; userIndex < 3; userIndex++) {
    const usedDates = new Set<string>();
    for (let day = 30; day >= 0; day--) {
      const logDate = daysAgo(day);
      const dateKey = logDate.toISOString().split('T')[0];
      if (usedDates.has(dateKey)) continue;
      usedDates.add(dateKey);

      await prisma.dailyLog.create({
        data: {
          user_id: createdUsers[userIndex].id,
          log_date: logDate,
          water_ml: randInt(1200, 3000),
          sleep_hours: randDecimal(5.5, 9.0),
          sleep_quality: randInt(1, 5),
          energy_level: randInt(1, 5),
          mood: randInt(1, 5),
          steps: randInt(3000, 15000),
        }
      });
      totalDailyLogs++;
    }
  }
  console.log(`  ${totalDailyLogs} daily logs creados.\n`);

  // RESUMEN FINAL
  console.log('═══════════════════════════════════════════════');
  console.log('SEED COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Usuarios:            ${createdUsers.length}`);
  console.log(`  Ejercicios:          ${exercises.length}`);
  console.log(`  Alimentos:           ${foods.length}`);
  console.log(`  Planes:              ${createdPlans.length}`);
  console.log(`  Sesiones entreno:    ${totalSessions}`);
  console.log(`  Registros progreso:  ${totalProgressLogs}`);
  console.log(`  Daily logs:          ${totalDailyLogs}`);
  console.log('═══════════════════════════════════════════════\n');
}

main()
  .catch(e => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
