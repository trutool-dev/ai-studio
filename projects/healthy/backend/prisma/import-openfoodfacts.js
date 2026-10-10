/**
 * Importa alimentos desde Open Food Facts (openfoodfacts.org).
 * Base de datos open source — sin clave API, sin límite de peticiones.
 * Importa ~700-1000 productos con nombre en español y macros completos.
 *
 * Ejecutar: node prisma/import-openfoodfacts.js
 */

require('dotenv').config();
const https = require('https');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

// Categorías a importar con su nombre en español (para fallback de nombre)
const CATEGORIES = [
  { tag: 'en:meats',                     label: 'Carnes'          },
  { tag: 'en:fish',                       label: 'Pescados'        },
  { tag: 'en:seafood',                    label: 'Mariscos'        },
  { tag: 'en:fruits',                     label: 'Frutas'          },
  { tag: 'en:vegetables',                 label: 'Verduras'        },
  { tag: 'en:dairy-products',             label: 'Lácteos'         },
  { tag: 'en:cereals-and-their-products', label: 'Cereales'        },
  { tag: 'en:legumes',                    label: 'Legumbres'       },
  { tag: 'en:nuts',                       label: 'Frutos secos'    },
  { tag: 'en:bread',                      label: 'Pan'             },
  { tag: 'en:pasta',                      label: 'Pasta'           },
  { tag: 'en:rice-dishes',               label: 'Arroz'           },
  { tag: 'en:eggs',                       label: 'Huevos'          },
  { tag: 'en:sauces',                     label: 'Salsas'          },
  { tag: 'en:soups',                      label: 'Sopas'           },
  { tag: 'en:snacks',                     label: 'Snacks'          },
  { tag: 'en:chocolate-products',         label: 'Chocolate'       },
  { tag: 'en:cheeses',                    label: 'Quesos'          },
  { tag: 'en:yogurts',                    label: 'Yogures'         },
  { tag: 'en:beverages',                  label: 'Bebidas'         },
];

const PRODUCTS_PER_CATEGORY = 60; // 20 categorías × 60 = hasta 1200 productos
const DELAY_MS   = 800;
const MAX_RETRIES = 4;        // reintentos en caso de 503
const RETRY_DELAY = 15000;    // 15 segundos entre reintentos

function httpsGet(url, attempt = 1) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'healthy-app-importer/1.0 (nutrition tracking app)' },
      timeout: 25000,
    }, res => {
      // Seguir redirecciones 301/302
      if (res.statusCode >= 301 && res.statusCode <= 302 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://world.openfoodfacts.org${res.headers.location}`;
        return resolve(httpsGet(loc, attempt));
      }
      // Reintentar en 503 (servicio temporalmente no disponible)
      if (res.statusCode === 503) {
        if (attempt <= MAX_RETRIES) {
          process.stdout.write(` ⏳ 503, reintentando en ${RETRY_DELAY / 1000}s (${attempt}/${MAX_RETRIES})...`);
          return setTimeout(() => resolve(httpsGet(url, attempt + 1)), RETRY_DELAY);
        }
        return reject(new Error(`503 tras ${MAX_RETRIES} intentos — Open Food Facts no disponible`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error (status ${res.statusCode})`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Devuelve el mejor nombre en español disponible para el producto.
 * Orden de preferencia: nombre ES > nombre genérico ES > nombre original.
 */
function getBestSpanishName(product) {
  const candidates = [
    product.product_name_es,
    product.product_name_fr && undefined, // ignorar francés
    product.product_name,
  ].filter(Boolean);

  for (const name of candidates) {
    const cleaned = name.trim();
    // Descartar nombres muy cortos, con solo números o claramente no-alimentos
    if (cleaned.length >= 3 && !/^\d+$/.test(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

function extractMacros(nutriments = {}) {
  const kcal    = parseFloat(nutriments['energy-kcal_100g']      ?? nutriments['energy_100g'] / 4.184 ?? null);
  const protein = parseFloat(nutriments['proteins_100g']          ?? null);
  const carbs   = parseFloat(nutriments['carbohydrates_100g']     ?? null);
  const fat     = parseFloat(nutriments['fat_100g']               ?? null);
  return { kcal, protein, carbs, fat };
}

function hasSufficientData({ kcal, protein, carbs, fat }) {
  // Requiere al menos calorías + 2 macros (algunos productos no tienen todos)
  const defined = [kcal, protein, carbs, fat].filter(v => v !== null && !isNaN(v));
  return defined.length >= 3 && kcal !== null && !isNaN(kcal) && kcal >= 0;
}

async function fetchCategory(tag, page = 1) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&json=1` +
    `&tagtype_0=categories&tag_contains_0=contains&tag_0=${encodeURIComponent(tag)}` +
    `&fields=product_name,product_name_es,brands,nutriments` +
    `&page_size=${PRODUCTS_PER_CATEGORY}&page=${page}&sort_by=unique_scans_n`;
  return httpsGet(url);
}

async function importCategory(category, stats) {
  const { tag, label } = category;
  process.stdout.write(`\n  [${label}] Descargando...`);

  let data;
  try {
    data = await fetchCategory(tag, 1);
  } catch (err) {
    process.stdout.write(` ❌ Error: ${err.message}`);
    stats.errors++;
    return;
  }

  const products = data.products || [];
  let catImported = 0;
  let catSkipped  = 0;

  for (const product of products) {
    const name = getBestSpanishName(product);
    if (!name) { catSkipped++; continue; }

    const macros = extractMacros(product.nutriments || {});
    if (!hasSufficientData(macros)) { catSkipped++; continue; }

    // Normalizar nombre: primera letra mayúscula
    const normalizedName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

    try {
      const exists = await prisma.food.findFirst({ where: { name: { equals: normalizedName, mode: 'insensitive' } } });
      if (exists) { catSkipped++; stats.skipped++; continue; }

      await prisma.food.create({
        data: {
          name:              normalizedName,
          brand:             product.brands?.split(',')[0]?.trim() || null,
          calories_per_100g: macros.kcal    ?? 0,
          protein_per_100g:  macros.protein ?? 0,
          carbs_per_100g:    macros.carbs   ?? 0,
          fat_per_100g:      macros.fat     ?? 0,
          verified:          false, // productos de usuarios, no verificados
        },
      });
      catImported++;
      stats.imported++;
    } catch {
      catSkipped++;
      stats.errors++;
    }
  }

  process.stdout.write(` ✅ ${catImported} importados, ${catSkipped} omitidos`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('=== Importación Open Food Facts ===');
  console.log(`Categorías: ${CATEGORIES.length} | Productos/categoría: ${PRODUCTS_PER_CATEGORY}`);
  console.log(`Máximo posible: ~${CATEGORIES.length * PRODUCTS_PER_CATEGORY} productos\n`);

  // Contar alimentos ya existentes
  const existing = await prisma.food.count();
  console.log(`Alimentos ya en DB: ${existing}`);

  const stats = { imported: 0, skipped: 0, errors: 0 };

  for (const category of CATEGORIES) {
    await importCategory(category, stats);
    await sleep(DELAY_MS);
  }

  const total = await prisma.food.count();
  console.log('\n\n=== Resultado ===');
  console.log(`  ✅ Nuevos importados : ${stats.imported}`);
  console.log(`  ⏭  Ya existían      : ${stats.skipped}`);
  console.log(`  ❌ Errores           : ${stats.errors}`);
  console.log(`  📦 Total en DB ahora : ${total}`);

  if (stats.errors === CATEGORIES.length) {
    console.log('\n⚠️  Todas las categorías fallaron.');
    console.log('   Open Food Facts está temporalmente no disponible (503).');
    console.log('   Vuelve a ejecutar el script en unos minutos:');
    console.log('   node prisma/import-openfoodfacts.js');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
