/**
 * Importa alimentos desde BEDCA (Base de Datos Española de Composición de Alimentos).
 * URL web service: http://www.bedca.net/bdpub/procquery.php
 *
 * Ejecutar: node prisma/import-bedca.js
 * Con DATABASE_URL custom: DATABASE_URL="postgresql://..." node prisma/import-bedca.js
 *
 * Proceso:
 *  1. Obtiene listado completo de alimentos de BEDCA
 *  2. Por cada alimento, obtiene sus macronutrientes (kcal, proteínas, CH, grasas)
 *  3. Hace upsert en la tabla foods (no duplica si ya existe por nombre)
 */

require('dotenv').config();
const http = require('http');
const { parseStringPromise } = require('xml2js');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BEDCA_URL = 'http://www.bedca.net/bdpub/procquery.php';
const CONCURRENCY = 3;   // peticiones simultáneas a BEDCA (no spamear)
const DELAY_MS    = 300; // ms entre lotes

// Mapa de códigos INFOODS → nuestros campos
const NUTRIENT_MAP = {
  ENERC_KCAL: 'calories_per_100g',
  PROTCNT:    'protein_per_100g',
  CHOCDF:     'carbs_per_100g',
  FAT:        'fat_per_100g',
  // BEDCA usa también estos alias
  ENERCKCAL:  'calories_per_100g',
  PROT:       'protein_per_100g',
  CHO:        'carbs_per_100g',
  GRASA:      'fat_per_100g',
};

/** Realiza un POST a la API de BEDCA con el XML de request */
function bedcaPost(xmlBody) {
  return new Promise((resolve, reject) => {
    const postData = `request=${encodeURIComponent(xmlBody)}`;
    const options = {
      hostname: 'www.bedca.net',
      path: '/bdpub/procquery.php',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 healthy-app-importer/1.0',
      },
      timeout: 15000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout BEDCA')); });
    req.write(postData);
    req.end();
  });
}

/** Obtiene la lista de todos los alimentos disponibles en BEDCA */
async function fetchFoodList() {
  const xml = `<food_list><lang>ES</lang></food_list>`;
  const raw = await bedcaPost(xml);

  if (!raw || raw.trim().length < 10) {
    throw new Error(`Respuesta vacía de BEDCA. ¿La API está disponible?\nRespuesta raw: ${raw}`);
  }

  let parsed;
  try {
    parsed = await parseStringPromise(raw, { explicitArray: false, trim: true });
  } catch (e) {
    console.error('[diagnóstico] Respuesta no es XML válido. Primeros 500 chars:');
    console.error(raw.slice(0, 500));
    throw new Error('BEDCA no devolvió XML válido. Ver diagnóstico arriba.');
  }

  // BEDCA puede devolver la lista bajo distintas claves según versión
  const root = parsed.food_list || parsed.foodlist || parsed;
  const items = root.food || root.item || [];
  const list  = Array.isArray(items) ? items : [items];

  console.log(`  ✔ Lista obtenida: ${list.length} alimentos`);
  return list;
}

/** Obtiene los macronutrientes de un alimento por su food_id */
async function fetchFoodNutrients(foodId) {
  const xml = `<food><food_id>${foodId}</food_id><lang>ES</lang></food>`;
  const raw = await bedcaPost(xml);

  let parsed;
  try {
    parsed = await parseStringPromise(raw, { explicitArray: false, trim: true });
  } catch {
    return null;
  }

  const food = parsed.food || parsed;
  const compList = food.component_list || food.components || {};
  const components = compList.component || compList.comp || [];
  const compsArr = Array.isArray(components) ? components : [components];

  const nutrients = { calories_per_100g: null, protein_per_100g: null, carbs_per_100g: null, fat_per_100g: null };

  for (const comp of compsArr) {
    const code  = (comp.component_code || comp.code || comp.compcode || '').toString().trim().toUpperCase();
    // BEDCA guarda el valor por 100g en distintos campos según versión
    const rawVal = comp.val_100g ?? comp.best_location ?? comp.value ?? comp.val ?? null;
    const val = rawVal !== null ? parseFloat(rawVal) : null;

    const field = NUTRIENT_MAP[code];
    if (field && val !== null && !isNaN(val)) {
      nutrients[field] = val;
    }
  }

  return nutrients;
}

/** Extrae el nombre del alimento de la estructura que devuelve BEDCA */
function extractName(item) {
  return (
    item.food_name_ES  ||
    item.food_name     ||
    item.name_ES       ||
    item.name          ||
    item['food-name']  ||
    item.foodname      ||
    ''
  ).toString().trim();
}

/** Extrae el food_id de la estructura */
function extractId(item) {
  return (item.food_id || item.foodid || item.id || '').toString().trim();
}

/** Procesa un lote de alimentos en paralelo */
async function processBatch(batch, stats) {
  await Promise.all(batch.map(async (item) => {
    const foodId = extractId(item);
    const name   = extractName(item);

    if (!foodId || !name) {
      stats.skipped++;
      return;
    }

    const nutrients = await fetchFoodNutrients(foodId).catch(() => null);

    if (!nutrients || nutrients.calories_per_100g === null) {
      stats.noData++;
      return;
    }

    try {
      await prisma.food.upsert({
        where: { name },
        update: {
          calories_per_100g: nutrients.calories_per_100g ?? 0,
          protein_per_100g:  nutrients.protein_per_100g  ?? 0,
          carbs_per_100g:    nutrients.carbs_per_100g    ?? 0,
          fat_per_100g:      nutrients.fat_per_100g      ?? 0,
          verified: true,
        },
        create: {
          name,
          calories_per_100g: nutrients.calories_per_100g ?? 0,
          protein_per_100g:  nutrients.protein_per_100g  ?? 0,
          carbs_per_100g:    nutrients.carbs_per_100g    ?? 0,
          fat_per_100g:      nutrients.fat_per_100g      ?? 0,
          verified: true,
        },
      });
      stats.created++;
    } catch (e) {
      console.warn(`  [warn] No se pudo guardar "${name}": ${e.message}`);
      stats.errors++;
    }
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('=== Importación BEDCA ===');
  console.log('Conectando a la API de BEDCA...\n');

  let foodList;
  try {
    foodList = await fetchFoodList();
  } catch (err) {
    console.error(`\n❌ Error al obtener lista de alimentos: ${err.message}`);
    console.error('\nPosibles causas:');
    console.error('  1. La API de BEDCA no está disponible en este momento');
    console.error('  2. La máquina no tiene acceso a http://www.bedca.net (Railway sí debería tenerlo)');
    console.error('  3. El formato de la API cambió');
    console.error('\nAlternativa: usar el seed manual con npm run seed:foods (150 alimentos ya incluidos)');
    process.exit(1);
  }

  const stats = { created: 0, skipped: 0, noData: 0, errors: 0 };
  const total  = foodList.length;

  console.log(`Procesando ${total} alimentos en lotes de ${CONCURRENCY}...\n`);

  for (let i = 0; i < total; i += CONCURRENCY) {
    const batch = foodList.slice(i, i + CONCURRENCY);
    await processBatch(batch, stats);

    const pct = Math.round(((i + batch.length) / total) * 100);
    process.stdout.write(`\r  Progreso: ${i + batch.length}/${total} (${pct}%) — guardados: ${stats.created}`);

    if (i + CONCURRENCY < total) await sleep(DELAY_MS);
  }

  console.log('\n');
  console.log('=== Resultado ===');
  console.log(`  ✅ Alimentos guardados : ${stats.created}`);
  console.log(`  ⚠️  Sin datos macro    : ${stats.noData}`);
  console.log(`  ⏭️  Omitidos           : ${stats.skipped}`);
  console.log(`  ❌ Errores DB          : ${stats.errors}`);
  console.log(`\nTotal procesados: ${total}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
