// Parcha ejercicios existentes con gifUrl, category, bodyPart y target del dataset
// Ejecutar: node projects/healthy/database/patchExerciseGifs.js

const { Pool } = require('../backend/node_modules/pg');

const DATASET_URL = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Fetching exercises from dataset...');
  const res = await fetch(DATASET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const exercises = await res.json();
  console.log(`Fetched ${exercises.length} exercises`);

  let updated = 0;
  let skipped = 0;
  const batchSize = 50;

  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    await Promise.all(batch.map(async (ex) => {
      const externalId = ex.id ? parseInt(ex.id, 10) : null;
      if (!externalId) { skipped++; return; }

      const gifUrl = ex.gif_url || ex.gifUrl || null;
      const category = ex.category || null;
      const bodyPart = ex.body_part || ex.bodyPart || null;
      const target = ex.target || ex.muscle_group || null;
      const secondaryMuscles = ex.secondary_muscles || ex.secondaryMuscles || [];
      const instructionsEn = ex.instructions?.en
        ? (Array.isArray(ex.instructions.en) ? ex.instructions.en.join(' ') : ex.instructions.en)
        : (typeof ex.instructions === 'string' ? ex.instructions : null);

      const result = await pool.query(
        `UPDATE exercises
         SET "gifUrl" = $1, category = $2, "bodyPart" = $3, target = $4,
             "secondaryMuscles" = $5, "instructionsEn" = $6
         WHERE "externalId" = $7`,
        [gifUrl, category, bodyPart, target, secondaryMuscles, instructionsEn, externalId]
      );
      if (result.rowCount > 0) updated++;
      else skipped++;
    }));

    const done = Math.min(i + batchSize, exercises.length);
    process.stdout.write(`\rProgress: ${done}/${exercises.length} — ${updated} updated`);
  }

  console.log(`\nDone: ${updated} exercises patched, ${skipped} skipped`);
  await pool.end();
}

main().catch(err => { console.error('\nFailed:', err.message); process.exit(1); });
