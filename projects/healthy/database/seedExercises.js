// Script de seed para importar 1.324 ejercicios desde hasaneyldrm/exercises-dataset
// Ejecutar: node projects/healthy/database/seedExercises.js
// Requiere: DATABASE_URL en el entorno

// Para importar el catálogo de ejercicios, ejecutar:
// node projects/healthy/database/seedExercises.js

const { PrismaClient } = require('../backend/src/generated/prisma');
const { Pool } = require('pg');

const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';

// Mapeador de dificultad basado en categoría y equipamiento
function mapDifficulty(exercise) {
  const equipment = exercise.equipment?.toLowerCase() || '';
  const bodyPart = exercise.bodyPart?.toLowerCase() || '';
  if (equipment === 'body weight' && !bodyPart.includes('upper')) return 'beginner';
  if (['cable', 'machine'].some(e => equipment.includes(e))) return 'intermediate';
  if (['barbell', 'olympic barbell'].some(e => equipment.includes(e))) return 'advanced';
  return 'intermediate';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let adapter;
  try {
    const { PrismaPg } = require('@prisma/adapter-pg');
    adapter = new PrismaPg(pool);
  } catch (e) {
    // Fallback: si @prisma/adapter-pg no está disponible, usar Prisma estándar
    console.warn('Warning: @prisma/adapter-pg not found, using standard Prisma client');
    adapter = undefined;
  }

  const prisma = adapter
    ? new PrismaClient({ adapter })
    : new PrismaClient();

  console.log('Fetching exercises from GitHub dataset...');
  const response = await fetch(DATASET_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

  const exercises = await response.json();
  console.log(`Fetched ${exercises.length} exercises`);

  // Mapear al schema de Prisma
  const mapped = exercises.map(ex => ({
    externalId: ex.id ? parseInt(ex.id, 10) : null,
    name: ex.name,
    category: ex.category || '',
    bodyPart: ex.bodyPart || '',
    equipment: ex.equipment || 'Body Weight',
    target: ex.target || ex.primaryMuscles?.[0] || '',
    secondaryMuscles: ex.secondaryMuscles || [],
    instructionsEs: Array.isArray(ex.instructions?.es) ? ex.instructions.es.join(' ') : (ex.instructions?.es || null),
    instructionsEn: Array.isArray(ex.instructions?.en) ? ex.instructions.en.join(' ') : (ex.instructions?.en || null),
    gifUrl: ex.gifUrl || null,
    thumbnailUrl: ex.thumbnailUrl || null,
    difficulty: mapDifficulty(ex),
    // Campos legacy para compatibilidad
    muscle_group: ex.target || ex.category || '',
    equipment_needed: ex.equipment || 'Body Weight',
  }));

  console.log('Inserting exercises into database...');

  // Insertar en batches de 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize);
    const result = await prisma.exercise.createMany({
      data: batch,
      skipDuplicates: true,
    });
    inserted += result.count;
    console.log(`Progress: ${Math.min(i + batchSize, mapped.length)}/${mapped.length} processed, ${inserted} inserted`);
  }

  console.log(`\nSeed complete: ${inserted} exercises inserted (${mapped.length - inserted} skipped as duplicates)`);
  await prisma.$disconnect();
  if (pool) await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
