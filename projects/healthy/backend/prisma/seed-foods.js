/**
 * Seed de alimentos comunes con macronutrientes por 100g.
 * Fuentes: BEDCA, USDA FoodData Central, Open Food Facts (valores verificados).
 * Ejecutar: node prisma/seed-foods.js
 */

const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const foods = [
  // ── CARNES ─────────────────────────────────────────────────────────
  { name: 'Pechuga de pollo (cocida)',    calories_per_100g: 165, protein_per_100g: 31.0, carbs_per_100g: 0.0,  fat_per_100g: 3.6,  verified: true },
  { name: 'Pechuga de pollo (cruda)',     calories_per_100g: 120, protein_per_100g: 22.5, carbs_per_100g: 0.0,  fat_per_100g: 2.6,  verified: true },
  { name: 'Muslo de pollo (cocido)',      calories_per_100g: 209, protein_per_100g: 26.0, carbs_per_100g: 0.0,  fat_per_100g: 10.9, verified: true },
  { name: 'Ternera (carne magra)',        calories_per_100g: 158, protein_per_100g: 26.1, carbs_per_100g: 0.0,  fat_per_100g: 5.4,  verified: true },
  { name: 'Lomo de cerdo',               calories_per_100g: 147, protein_per_100g: 21.0, carbs_per_100g: 0.0,  fat_per_100g: 6.8,  verified: true },
  { name: 'Solomillo de ternera',        calories_per_100g: 143, protein_per_100g: 22.0, carbs_per_100g: 0.0,  fat_per_100g: 6.0,  verified: true },
  { name: 'Costillas de cerdo',          calories_per_100g: 292, protein_per_100g: 17.1, carbs_per_100g: 0.0,  fat_per_100g: 24.3, verified: true },
  { name: 'Jamón serrano',               calories_per_100g: 241, protein_per_100g: 30.5, carbs_per_100g: 0.5,  fat_per_100g: 12.0, verified: true },
  { name: 'Jamón cocido (york)',          calories_per_100g: 107, protein_per_100g: 18.0, carbs_per_100g: 1.5,  fat_per_100g: 3.2,  verified: true },
  { name: 'Pavo (pechuga)',              calories_per_100g: 135, protein_per_100g: 29.9, carbs_per_100g: 0.0,  fat_per_100g: 1.0,  verified: true },
  { name: 'Cordero (pierna)',            calories_per_100g: 206, protein_per_100g: 26.0, carbs_per_100g: 0.0,  fat_per_100g: 10.7, verified: true },
  { name: 'Chorizo',                     calories_per_100g: 455, protein_per_100g: 24.1, carbs_per_100g: 1.9,  fat_per_100g: 38.3, verified: true },
  { name: 'Salchichón',                  calories_per_100g: 382, protein_per_100g: 22.0, carbs_per_100g: 2.0,  fat_per_100g: 32.0, verified: true },
  { name: 'Bacon (panceta ahumada)',     calories_per_100g: 417, protein_per_100g: 12.2, carbs_per_100g: 0.1,  fat_per_100g: 40.7, verified: true },

  // ── PESCADOS Y MARISCOS ────────────────────────────────────────────
  { name: 'Salmón (fresco)',             calories_per_100g: 208, protein_per_100g: 20.4, carbs_per_100g: 0.0,  fat_per_100g: 13.4, verified: true },
  { name: 'Atún (fresco)',               calories_per_100g: 144, protein_per_100g: 23.3, carbs_per_100g: 0.0,  fat_per_100g: 4.9,  verified: true },
  { name: 'Atún en lata (al natural)',   calories_per_100g: 116, protein_per_100g: 26.0, carbs_per_100g: 0.0,  fat_per_100g: 1.0,  verified: true },
  { name: 'Atún en lata (en aceite)',    calories_per_100g: 198, protein_per_100g: 23.5, carbs_per_100g: 0.0,  fat_per_100g: 11.5, verified: true },
  { name: 'Merluza',                     calories_per_100g: 86,  protein_per_100g: 17.8, carbs_per_100g: 0.0,  fat_per_100g: 1.4,  verified: true },
  { name: 'Bacalao (fresco)',            calories_per_100g: 82,  protein_per_100g: 17.8, carbs_per_100g: 0.0,  fat_per_100g: 0.7,  verified: true },
  { name: 'Dorada',                      calories_per_100g: 96,  protein_per_100g: 18.4, carbs_per_100g: 0.0,  fat_per_100g: 2.6,  verified: true },
  { name: 'Lubina',                      calories_per_100g: 97,  protein_per_100g: 18.4, carbs_per_100g: 0.0,  fat_per_100g: 2.5,  verified: true },
  { name: 'Sardinas (en lata)',          calories_per_100g: 208, protein_per_100g: 24.6, carbs_per_100g: 0.0,  fat_per_100g: 11.5, verified: true },
  { name: 'Gambas (cocidas)',            calories_per_100g: 99,  protein_per_100g: 20.1, carbs_per_100g: 0.9,  fat_per_100g: 1.7,  verified: true },
  { name: 'Mejillones',                  calories_per_100g: 86,  protein_per_100g: 11.9, carbs_per_100g: 3.7,  fat_per_100g: 2.2,  verified: true },
  { name: 'Calamar',                     calories_per_100g: 92,  protein_per_100g: 15.6, carbs_per_100g: 3.1,  fat_per_100g: 1.4,  verified: true },

  // ── HUEVOS Y LÁCTEOS ──────────────────────────────────────────────
  { name: 'Huevo entero (mediano)',      calories_per_100g: 143, protein_per_100g: 12.6, carbs_per_100g: 0.7,  fat_per_100g: 9.5,  verified: true },
  { name: 'Clara de huevo',             calories_per_100g: 52,  protein_per_100g: 10.9, carbs_per_100g: 0.7,  fat_per_100g: 0.2,  verified: true },
  { name: 'Yema de huevo',              calories_per_100g: 322, protein_per_100g: 16.0, carbs_per_100g: 0.6,  fat_per_100g: 26.5, verified: true },
  { name: 'Leche entera',               calories_per_100g: 61,  protein_per_100g: 3.2,  carbs_per_100g: 4.8,  fat_per_100g: 3.5,  verified: true },
  { name: 'Leche desnatada',            calories_per_100g: 35,  protein_per_100g: 3.4,  carbs_per_100g: 5.0,  fat_per_100g: 0.1,  verified: true },
  { name: 'Leche semidesnatada',        calories_per_100g: 46,  protein_per_100g: 3.3,  carbs_per_100g: 4.9,  fat_per_100g: 1.5,  verified: true },
  { name: 'Yogur natural (entero)',      calories_per_100g: 61,  protein_per_100g: 3.5,  carbs_per_100g: 4.7,  fat_per_100g: 3.3,  verified: true },
  { name: 'Yogur natural (desnatado)',   calories_per_100g: 36,  protein_per_100g: 4.3,  carbs_per_100g: 4.5,  fat_per_100g: 0.2,  verified: true },
  { name: 'Yogur griego (entero)',       calories_per_100g: 97,  protein_per_100g: 9.0,  carbs_per_100g: 3.6,  fat_per_100g: 5.0,  verified: true },
  { name: 'Queso fresco (Burgos)',       calories_per_100g: 174, protein_per_100g: 13.3, carbs_per_100g: 3.3,  fat_per_100g: 12.4, verified: true },
  { name: 'Queso manchego',             calories_per_100g: 391, protein_per_100g: 26.0, carbs_per_100g: 0.5,  fat_per_100g: 32.0, verified: true },
  { name: 'Queso parmesano',            calories_per_100g: 431, protein_per_100g: 38.5, carbs_per_100g: 3.2,  fat_per_100g: 29.0, verified: true },
  { name: 'Queso cottage',              calories_per_100g: 98,  protein_per_100g: 11.1, carbs_per_100g: 3.4,  fat_per_100g: 4.3,  verified: true },
  { name: 'Mozzarella',                 calories_per_100g: 280, protein_per_100g: 22.0, carbs_per_100g: 2.2,  fat_per_100g: 20.0, verified: true },
  { name: 'Nata líquida (35% materia grasa)', calories_per_100g: 345, protein_per_100g: 2.1, carbs_per_100g: 2.8, fat_per_100g: 35.1, verified: true },
  { name: 'Mantequilla',                calories_per_100g: 717, protein_per_100g: 0.9,  carbs_per_100g: 0.1,  fat_per_100g: 81.1, verified: true },

  // ── PROTEÍNA EN POLVO ─────────────────────────────────────────────
  { name: 'Proteína whey (vainilla)',    calories_per_100g: 382, protein_per_100g: 75.0, carbs_per_100g: 10.0, fat_per_100g: 5.5,  verified: true },
  { name: 'Proteína whey (chocolate)',   calories_per_100g: 378, protein_per_100g: 73.0, carbs_per_100g: 11.0, fat_per_100g: 5.5,  verified: true },
  { name: 'Proteína vegetal (guisante)', calories_per_100g: 364, protein_per_100g: 80.0, carbs_per_100g: 2.0,  fat_per_100g: 6.0,  verified: true },
  { name: 'Caseína (proteína lenta)',    calories_per_100g: 356, protein_per_100g: 80.0, carbs_per_100g: 3.5,  fat_per_100g: 1.5,  verified: true },

  // ── CEREALES Y GRANOS ─────────────────────────────────────────────
  { name: 'Arroz blanco (cocido)',       calories_per_100g: 130, protein_per_100g: 2.7,  carbs_per_100g: 28.2, fat_per_100g: 0.3,  verified: true },
  { name: 'Arroz integral (cocido)',     calories_per_100g: 123, protein_per_100g: 2.7,  carbs_per_100g: 25.6, fat_per_100g: 1.0,  verified: true },
  { name: 'Pasta (cocida)',              calories_per_100g: 131, protein_per_100g: 5.0,  carbs_per_100g: 25.0, fat_per_100g: 1.1,  verified: true },
  { name: 'Pasta integral (cocida)',     calories_per_100g: 124, protein_per_100g: 5.3,  carbs_per_100g: 23.2, fat_per_100g: 0.9,  verified: true },
  { name: 'Avena (cruda)',              calories_per_100g: 379, protein_per_100g: 13.2, carbs_per_100g: 67.7, fat_per_100g: 6.9,  verified: true },
  { name: 'Copos de avena',             calories_per_100g: 367, protein_per_100g: 12.5, carbs_per_100g: 67.4, fat_per_100g: 6.5,  verified: true },
  { name: 'Pan blanco',                 calories_per_100g: 265, protein_per_100g: 7.6,  carbs_per_100g: 49.4, fat_per_100g: 3.2,  verified: true },
  { name: 'Pan integral',               calories_per_100g: 247, protein_per_100g: 9.7,  carbs_per_100g: 46.1, fat_per_100g: 2.9,  verified: true },
  { name: 'Quinoa (cocida)',             calories_per_100g: 120, protein_per_100g: 4.4,  carbs_per_100g: 21.3, fat_per_100g: 1.9,  verified: true },
  { name: 'Maíz dulce (cocido)',         calories_per_100g: 86,  protein_per_100g: 3.2,  carbs_per_100g: 18.7, fat_per_100g: 1.2,  verified: true },
  { name: 'Tortilla de maíz',           calories_per_100g: 218, protein_per_100g: 5.7,  carbs_per_100g: 45.9, fat_per_100g: 2.5,  verified: true },

  // ── LEGUMBRES ─────────────────────────────────────────────────────
  { name: 'Garbanzos (cocidos)',         calories_per_100g: 164, protein_per_100g: 8.9,  carbs_per_100g: 27.4, fat_per_100g: 2.6,  verified: true },
  { name: 'Lentejas (cocidas)',          calories_per_100g: 116, protein_per_100g: 9.0,  carbs_per_100g: 20.1, fat_per_100g: 0.4,  verified: true },
  { name: 'Alubias blancas (cocidas)',   calories_per_100g: 127, protein_per_100g: 8.7,  carbs_per_100g: 22.8, fat_per_100g: 0.5,  verified: true },
  { name: 'Alubias negras (cocidas)',    calories_per_100g: 132, protein_per_100g: 8.9,  carbs_per_100g: 23.7, fat_per_100g: 0.5,  verified: true },
  { name: 'Edamame (habas soja cocidas)',calories_per_100g: 122, protein_per_100g: 11.9, carbs_per_100g: 8.9,  fat_per_100g: 5.2,  verified: true },
  { name: 'Tofu (firme)',               calories_per_100g: 76,  protein_per_100g: 8.1,  carbs_per_100g: 1.9,  fat_per_100g: 4.2,  verified: true },
  { name: 'Guisantes (cocidos)',         calories_per_100g: 84,  protein_per_100g: 5.4,  carbs_per_100g: 15.6, fat_per_100g: 0.4,  verified: true },

  // ── VERDURAS Y HORTALIZAS ─────────────────────────────────────────
  { name: 'Brócoli (cocido)',            calories_per_100g: 35,  protein_per_100g: 2.4,  carbs_per_100g: 7.2,  fat_per_100g: 0.4,  verified: true },
  { name: 'Espinacas (crudas)',          calories_per_100g: 23,  protein_per_100g: 2.9,  carbs_per_100g: 3.6,  fat_per_100g: 0.4,  verified: true },
  { name: 'Tomate (crudo)',              calories_per_100g: 18,  protein_per_100g: 0.9,  carbs_per_100g: 3.9,  fat_per_100g: 0.2,  verified: true },
  { name: 'Zanahoria (cruda)',           calories_per_100g: 41,  protein_per_100g: 0.9,  carbs_per_100g: 9.6,  fat_per_100g: 0.2,  verified: true },
  { name: 'Pepino',                      calories_per_100g: 15,  protein_per_100g: 0.7,  carbs_per_100g: 3.6,  fat_per_100g: 0.1,  verified: true },
  { name: 'Lechuga',                     calories_per_100g: 15,  protein_per_100g: 1.4,  carbs_per_100g: 2.9,  fat_per_100g: 0.2,  verified: true },
  { name: 'Pimiento rojo',               calories_per_100g: 31,  protein_per_100g: 1.0,  carbs_per_100g: 7.3,  fat_per_100g: 0.3,  verified: true },
  { name: 'Pimiento verde',              calories_per_100g: 20,  protein_per_100g: 0.9,  carbs_per_100g: 4.6,  fat_per_100g: 0.2,  verified: true },
  { name: 'Cebolla',                     calories_per_100g: 40,  protein_per_100g: 1.1,  carbs_per_100g: 9.3,  fat_per_100g: 0.1,  verified: true },
  { name: 'Ajo',                         calories_per_100g: 149, protein_per_100g: 6.4,  carbs_per_100g: 33.1, fat_per_100g: 0.5,  verified: true },
  { name: 'Calabacín (crudo)',           calories_per_100g: 17,  protein_per_100g: 1.2,  carbs_per_100g: 3.1,  fat_per_100g: 0.3,  verified: true },
  { name: 'Berenjena',                   calories_per_100g: 25,  protein_per_100g: 1.0,  carbs_per_100g: 5.9,  fat_per_100g: 0.2,  verified: true },
  { name: 'Champiñones (crudos)',        calories_per_100g: 22,  protein_per_100g: 3.1,  carbs_per_100g: 3.3,  fat_per_100g: 0.3,  verified: true },
  { name: 'Coliflor',                    calories_per_100g: 25,  protein_per_100g: 1.9,  carbs_per_100g: 5.0,  fat_per_100g: 0.3,  verified: true },
  { name: 'Espárragos',                  calories_per_100g: 20,  protein_per_100g: 2.2,  carbs_per_100g: 3.9,  fat_per_100g: 0.1,  verified: true },
  { name: 'Judías verdes (cocidas)',     calories_per_100g: 35,  protein_per_100g: 1.9,  carbs_per_100g: 7.1,  fat_per_100g: 0.4,  verified: true },
  { name: 'Acelgas (cocidas)',           calories_per_100g: 20,  protein_per_100g: 1.9,  carbs_per_100g: 4.1,  fat_per_100g: 0.1,  verified: true },

  // ── TUBÉRCULOS ─────────────────────────────────────────────────────
  { name: 'Patata (cocida)',             calories_per_100g: 87,  protein_per_100g: 1.9,  carbs_per_100g: 20.1, fat_per_100g: 0.1,  verified: true },
  { name: 'Patata asada',               calories_per_100g: 93,  protein_per_100g: 2.5,  carbs_per_100g: 21.1, fat_per_100g: 0.1,  verified: true },
  { name: 'Boniato (cocido)',            calories_per_100g: 86,  protein_per_100g: 1.6,  carbs_per_100g: 20.1, fat_per_100g: 0.1,  verified: true },

  // ── FRUTAS ────────────────────────────────────────────────────────
  { name: 'Manzana',                     calories_per_100g: 52,  protein_per_100g: 0.3,  carbs_per_100g: 13.8, fat_per_100g: 0.2,  verified: true },
  { name: 'Plátano',                     calories_per_100g: 89,  protein_per_100g: 1.1,  carbs_per_100g: 22.8, fat_per_100g: 0.3,  verified: true },
  { name: 'Naranja',                     calories_per_100g: 47,  protein_per_100g: 0.9,  carbs_per_100g: 11.8, fat_per_100g: 0.1,  verified: true },
  { name: 'Fresa',                       calories_per_100g: 32,  protein_per_100g: 0.7,  carbs_per_100g: 7.7,  fat_per_100g: 0.3,  verified: true },
  { name: 'Uva',                         calories_per_100g: 69,  protein_per_100g: 0.7,  carbs_per_100g: 18.1, fat_per_100g: 0.2,  verified: true },
  { name: 'Pera',                        calories_per_100g: 57,  protein_per_100g: 0.4,  carbs_per_100g: 15.2, fat_per_100g: 0.1,  verified: true },
  { name: 'Sandía',                      calories_per_100g: 30,  protein_per_100g: 0.6,  carbs_per_100g: 7.6,  fat_per_100g: 0.2,  verified: true },
  { name: 'Melón',                       calories_per_100g: 34,  protein_per_100g: 0.8,  carbs_per_100g: 8.2,  fat_per_100g: 0.2,  verified: true },
  { name: 'Piña',                        calories_per_100g: 50,  protein_per_100g: 0.5,  carbs_per_100g: 13.1, fat_per_100g: 0.1,  verified: true },
  { name: 'Mango',                       calories_per_100g: 65,  protein_per_100g: 0.8,  carbs_per_100g: 17.0, fat_per_100g: 0.3,  verified: true },
  { name: 'Kiwi',                        calories_per_100g: 61,  protein_per_100g: 1.1,  carbs_per_100g: 14.7, fat_per_100g: 0.5,  verified: true },
  { name: 'Melocotón',                   calories_per_100g: 39,  protein_per_100g: 0.9,  carbs_per_100g: 9.5,  fat_per_100g: 0.3,  verified: true },
  { name: 'Arándanos',                   calories_per_100g: 57,  protein_per_100g: 0.7,  carbs_per_100g: 14.5, fat_per_100g: 0.3,  verified: true },
  { name: 'Frambuesas',                  calories_per_100g: 52,  protein_per_100g: 1.2,  carbs_per_100g: 11.9, fat_per_100g: 0.7,  verified: true },
  { name: 'Cereza',                      calories_per_100g: 63,  protein_per_100g: 1.1,  carbs_per_100g: 16.0, fat_per_100g: 0.2,  verified: true },
  { name: 'Aguacate',                    calories_per_100g: 160, protein_per_100g: 2.0,  carbs_per_100g: 8.5,  fat_per_100g: 14.7, verified: true },

  // ── FRUTOS SECOS Y SEMILLAS ───────────────────────────────────────
  { name: 'Almendras',                   calories_per_100g: 579, protein_per_100g: 21.2, carbs_per_100g: 21.6, fat_per_100g: 49.9, verified: true },
  { name: 'Nueces',                      calories_per_100g: 654, protein_per_100g: 15.2, carbs_per_100g: 13.7, fat_per_100g: 65.2, verified: true },
  { name: 'Cacahuetes',                  calories_per_100g: 567, protein_per_100g: 25.8, carbs_per_100g: 16.1, fat_per_100g: 49.2, verified: true },
  { name: 'Anacardos',                   calories_per_100g: 553, protein_per_100g: 18.2, carbs_per_100g: 30.2, fat_per_100g: 43.9, verified: true },
  { name: 'Pistachos',                   calories_per_100g: 562, protein_per_100g: 20.2, carbs_per_100g: 27.2, fat_per_100g: 45.3, verified: true },
  { name: 'Semillas de chía',            calories_per_100g: 486, protein_per_100g: 16.5, carbs_per_100g: 42.1, fat_per_100g: 30.7, verified: true },
  { name: 'Semillas de lino',            calories_per_100g: 534, protein_per_100g: 18.3, carbs_per_100g: 28.9, fat_per_100g: 42.2, verified: true },
  { name: 'Mantequilla de cacahuete',    calories_per_100g: 588, protein_per_100g: 25.1, carbs_per_100g: 19.6, fat_per_100g: 50.4, verified: true },

  // ── ACEITES Y GRASAS ──────────────────────────────────────────────
  { name: 'Aceite de oliva virgen extra',calories_per_100g: 884, protein_per_100g: 0.0,  carbs_per_100g: 0.0,  fat_per_100g: 100.0,verified: true },
  { name: 'Aceite de girasol',           calories_per_100g: 884, protein_per_100g: 0.0,  carbs_per_100g: 0.0,  fat_per_100g: 100.0,verified: true },
  { name: 'Aceite de coco',             calories_per_100g: 862, protein_per_100g: 0.0,  carbs_per_100g: 0.0,  fat_per_100g: 100.0,verified: true },

  // ── SALSAS Y CONDIMENTOS ──────────────────────────────────────────
  { name: 'Salsa de tomate (casera)',    calories_per_100g: 44,  protein_per_100g: 1.9,  carbs_per_100g: 8.6,  fat_per_100g: 0.5,  verified: true },
  { name: 'Ketchup',                     calories_per_100g: 112, protein_per_100g: 1.4,  carbs_per_100g: 27.4, fat_per_100g: 0.2,  verified: true },
  { name: 'Mayonesa',                    calories_per_100g: 680, protein_per_100g: 1.0,  carbs_per_100g: 2.4,  fat_per_100g: 74.9, verified: true },
  { name: 'Mostaza',                     calories_per_100g: 66,  protein_per_100g: 4.4,  carbs_per_100g: 6.5,  fat_per_100g: 3.3,  verified: true },

  // ── BEBIDAS ───────────────────────────────────────────────────────
  { name: 'Agua',                        calories_per_100g: 0,   protein_per_100g: 0.0,  carbs_per_100g: 0.0,  fat_per_100g: 0.0,  verified: true },
  { name: 'Zumo de naranja (natural)',   calories_per_100g: 45,  protein_per_100g: 0.7,  carbs_per_100g: 10.4, fat_per_100g: 0.2,  verified: true },
  { name: 'Leche de avena',             calories_per_100g: 48,  protein_per_100g: 1.0,  carbs_per_100g: 9.4,  fat_per_100g: 0.8,  verified: true },
  { name: 'Leche de almendras',         calories_per_100g: 17,  protein_per_100g: 0.6,  carbs_per_100g: 1.0,  fat_per_100g: 1.4,  verified: true },
  { name: 'Leche de soja',              calories_per_100g: 42,  protein_per_100g: 3.3,  carbs_per_100g: 2.8,  fat_per_100g: 2.2,  verified: true },

  // ── DULCES Y SNACKS ───────────────────────────────────────────────
  { name: 'Chocolate negro (70%)',       calories_per_100g: 598, protein_per_100g: 8.4,  carbs_per_100g: 46.4, fat_per_100g: 42.6, verified: true },
  { name: 'Chocolate con leche',        calories_per_100g: 535, protein_per_100g: 7.7,  carbs_per_100g: 59.3, fat_per_100g: 30.0, verified: true },
  { name: 'Miel',                        calories_per_100g: 304, protein_per_100g: 0.3,  carbs_per_100g: 82.4, fat_per_100g: 0.0,  verified: true },
  { name: 'Mermelada (fresa)',           calories_per_100g: 250, protein_per_100g: 0.4,  carbs_per_100g: 65.0, fat_per_100g: 0.1,  verified: true },
  { name: 'Galletas María',             calories_per_100g: 437, protein_per_100g: 7.5,  carbs_per_100g: 74.8, fat_per_100g: 12.8, verified: true },

  // ── COMIDAS PREPARADAS COMUNES ────────────────────────────────────
  { name: 'Tortilla española',          calories_per_100g: 185, protein_per_100g: 10.3, carbs_per_100g: 12.8, fat_per_100g: 10.3, verified: true },
  { name: 'Paella de pollo y verduras', calories_per_100g: 137, protein_per_100g: 8.5,  carbs_per_100g: 18.0, fat_per_100g: 3.5,  verified: true },
  { name: 'Gazpacho',                   calories_per_100g: 36,  protein_per_100g: 1.1,  carbs_per_100g: 6.0,  fat_per_100g: 1.0,  verified: true },
];

async function main() {
  console.log(`Iniciando seed de ${foods.length} alimentos...`);

  let created = 0;
  let skipped = 0;

  for (const food of foods) {
    const existing = await prisma.food.findFirst({ where: { name: food.name } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.food.create({ data: food });
    created++;
  }

  console.log(`✅ Seed completado: ${created} creados, ${skipped} ya existían.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
