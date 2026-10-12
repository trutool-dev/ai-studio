/**
 * Importa alimentos desde USDA FoodData Central (Foundation Foods).
 * API gratuita, sin clave para DEMO_KEY (30 req/h, 50/día).
 *
 * Para importar sin límite: registra clave gratis en https://api.data.gov/signup/
 * y pásala como variable de entorno:
 *   USDA_API_KEY=tu_clave node prisma/import-usda.js
 *
 * Ejecutar: node prisma/import-usda.js
 */

require('dotenv').config();
const https = require('https');
const { PrismaClient } = require('../src/generated/prisma');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });
const API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';
const BASE    = 'api.nal.usda.gov';

// Alimentos en español con término de búsqueda en inglés para USDA
// Formato: [nombre_español, término_búsqueda_usda]
const FOOD_MAP = [
  // Carnes
  ['Pechuga de pollo (cruda)',        'chicken breast raw'],
  ['Pechuga de pollo (cocida)',        'chicken breast cooked'],
  ['Muslo de pollo (cocido)',          'chicken thigh cooked'],
  ['Pavo, pechuga (cruda)',            'turkey breast raw'],
  ['Carne de ternera (magra)',         'beef tenderloin raw lean'],
  ['Lomo de cerdo',                    'pork loin raw'],
  ['Solomillo de cerdo',               'pork tenderloin raw'],
  ['Costillas de cerdo',               'pork ribs raw'],
  ['Carne picada de ternera',          'ground beef 90% lean'],
  ['Carne picada de cerdo',            'ground pork raw'],
  ['Cordero, pierna',                  'lamb leg raw'],
  ['Pato, pechuga',                    'duck breast raw'],
  ['Conejo',                           'rabbit raw'],
  ['Hígado de ternera',                'beef liver raw'],
  ['Panceta (tocino)',                 'pork belly raw'],
  // Pescados y mariscos
  ['Salmón, atlántico (crudo)',        'salmon atlantic raw'],
  ['Atún, aleta amarilla (crudo)',     'yellowfin tuna raw'],
  ['Merluza (cruda)',                  'hake raw'],
  ['Bacalao (crudo)',                  'cod Atlantic raw'],
  ['Dorada (cruda)',                   'sea bream raw'],
  ['Lubina (cruda)',                   'sea bass raw'],
  ['Trucha (cruda)',                   'trout raw'],
  ['Sardinas (crudas)',                'sardines raw'],
  ['Caballa (cruda)',                  'mackerel raw'],
  ['Boquerón (anchoa, crudo)',         'anchovy raw'],
  ['Gambas (crudas)',                  'shrimp raw'],
  ['Langostinos (cocidos)',            'prawns cooked'],
  ['Mejillones (cocidos)',             'mussels cooked'],
  ['Almejas (crudas)',                 'clams raw'],
  ['Pulpo (cocido)',                   'octopus cooked'],
  ['Calamar (crudo)',                  'squid raw'],
  ['Cangrejo (cocido)',                'crab cooked'],
  ['Atún en lata, agua',              'canned tuna in water'],
  ['Salmón en lata',                  'canned salmon'],
  ['Sardinas en aceite',              'sardines in oil canned'],
  // Huevos y lácteos
  ['Huevo entero (crudo)',             'egg whole raw'],
  ['Clara de huevo (cruda)',           'egg white raw'],
  ['Yema de huevo (cruda)',            'egg yolk raw'],
  ['Leche entera',                     'whole milk'],
  ['Leche desnatada',                  'skim milk nonfat'],
  ['Leche semidesnatada',              'reduced fat milk 2%'],
  ['Yogur natural entero',             'plain whole milk yogurt'],
  ['Yogur natural desnatado',          'plain nonfat yogurt'],
  ['Yogur griego entero',              'greek yogurt whole milk plain'],
  ['Queso cheddar',                    'cheddar cheese'],
  ['Queso mozzarella',                 'mozzarella cheese'],
  ['Queso parmesano',                  'parmesan cheese'],
  ['Queso cottage',                    'cottage cheese lowfat'],
  ['Queso crema',                      'cream cheese'],
  ['Leche de cabra',                   'goat milk'],
  ['Queso ricotta',                    'ricotta cheese whole milk'],
  ['Nata para cocinar (18% MG)',       'light cream cooking'],
  // Cereales y granos
  ['Arroz blanco (cocido)',            'white rice cooked'],
  ['Arroz integral (cocido)',          'brown rice cooked'],
  ['Arroz basmati (cocido)',           'basmati rice cooked'],
  ['Pasta (cocida)',                   'pasta cooked enriched'],
  ['Pasta integral (cocida)',          'whole wheat pasta cooked'],
  ['Espaguetis (cocidos)',             'spaghetti cooked'],
  ['Macarrones (cocidos)',             'macaroni cooked enriched'],
  ['Avena, copos',                     'rolled oats dry'],
  ['Harina de trigo',                  'all purpose flour wheat'],
  ['Pan blanco de molde',              'white bread sandwich'],
  ['Pan integral de trigo',            'whole wheat bread'],
  ['Pan de centeno',                   'rye bread'],
  ['Quinoa (cocida)',                  'quinoa cooked'],
  ['Cuscús (cocido)',                  'couscous cooked'],
  ['Bulgur (cocido)',                  'bulgur cooked'],
  ['Mijo (cocido)',                    'millet cooked'],
  ['Trigo sarraceno (copos)',          'buckwheat groats raw'],
  ['Maíz dulce (cocido)',              'sweet corn cooked'],
  ['Tortitas de arroz',               'rice cakes plain'],
  ['Cereales de desayuno (copos maíz)', 'corn flakes cereal'],
  ['Muesli',                           'muesli dry'],
  // Legumbres
  ['Garbanzos (cocidos)',              'chickpeas cooked'],
  ['Lentejas (cocidas)',               'lentils cooked'],
  ['Alubias negras (cocidas)',         'black beans cooked'],
  ['Alubias blancas (cocidas)',        'navy beans cooked'],
  ['Alubias rojas (cocidas)',          'kidney beans cooked'],
  ['Guisantes (cocidos)',              'green peas cooked'],
  ['Edamame (cocido)',                 'edamame cooked'],
  ['Soja (cocida)',                    'soybeans cooked'],
  ['Tofu firme',                       'tofu firm'],
  ['Tempeh',                           'tempeh'],
  ['Hummus',                           'hummus commercial'],
  // Verduras y hortalizas
  ['Brócoli (crudo)',                  'broccoli raw'],
  ['Brócoli (cocido)',                 'broccoli cooked'],
  ['Espinacas (crudas)',               'spinach raw'],
  ['Espinacas (cocidas)',              'spinach cooked'],
  ['Tomate (crudo)',                   'tomatoes raw'],
  ['Tomate cherry',                    'cherry tomatoes raw'],
  ['Zanahoria (cruda)',                'carrots raw'],
  ['Pepino',                           'cucumber raw'],
  ['Lechuga romana',                   'romaine lettuce raw'],
  ['Canónigos (rúcula)',               'arugula raw'],
  ['Pimiento rojo (crudo)',            'red bell pepper raw'],
  ['Pimiento verde (crudo)',           'green bell pepper raw'],
  ['Cebolla (cruda)',                  'onion raw'],
  ['Cebolla morada',                   'red onion raw'],
  ['Ajo (crudo)',                      'garlic raw'],
  ['Calabacín (crudo)',                'zucchini raw'],
  ['Berenjena (cruda)',                'eggplant raw'],
  ['Champiñones (crudos)',             'white mushrooms raw'],
  ['Coliflor (cruda)',                 'cauliflower raw'],
  ['Espárragos (crudos)',              'asparagus raw'],
  ['Judías verdes (crudas)',           'green beans raw'],
  ['Acelgas (cocidas)',                'swiss chard cooked'],
  ['Col (repollo, crudo)',             'cabbage raw'],
  ['Col lombarda',                     'red cabbage raw'],
  ['Coles de Bruselas (cocidas)',      'brussels sprouts cooked'],
  ['Kale (col rizada, crudo)',         'kale raw'],
  ['Apio (crudo)',                     'celery raw'],
  ['Rábano',                           'radishes raw'],
  ['Remolacha (cocida)',               'beets cooked'],
  ['Puerro (crudo)',                   'leeks raw'],
  ['Maíz dulce (crudo)',               'sweet corn raw'],
  ['Alcachofa (cocida)',               'artichoke cooked'],
  ['Guisantes frescos',               'fresh peas raw'],
  // Tubérculos
  ['Patata (cruda)',                   'potato raw'],
  ['Patata (hervida)',                 'potato boiled no skin'],
  ['Patata dulce / boniato (cruda)',   'sweet potato raw'],
  ['Boniato (cocido)',                 'sweet potato cooked'],
  ['Yuca (cruda)',                     'cassava raw'],
  // Frutas
  ['Manzana (con piel)',               'apple raw with skin'],
  ['Plátano',                          'banana raw'],
  ['Naranja',                          'orange raw'],
  ['Mandarina',                        'tangerine raw'],
  ['Limón (zumo)',                     'lemon juice raw'],
  ['Fresa',                            'strawberries raw'],
  ['Arándanos',                        'blueberries raw'],
  ['Frambuesas',                       'raspberries raw'],
  ['Moras',                            'blackberries raw'],
  ['Uva (verde)',                      'grapes raw'],
  ['Pera',                             'pear raw'],
  ['Sandía',                           'watermelon raw'],
  ['Melón (cantalupo)',                'cantaloupe raw'],
  ['Piña',                             'pineapple raw'],
  ['Mango',                            'mango raw'],
  ['Kiwi',                             'kiwi raw'],
  ['Melocotón',                        'peach raw'],
  ['Nectarina',                        'nectarine raw'],
  ['Ciruela',                          'plum raw'],
  ['Cereza',                           'cherries raw'],
  ['Higo (fresco)',                    'figs raw'],
  ['Granada',                          'pomegranate raw'],
  ['Papaya',                           'papaya raw'],
  ['Aguacate',                         'avocado raw'],
  ['Dátil',                            'dates medjool'],
  // Frutos secos y semillas
  ['Almendras (crudas)',               'almonds raw'],
  ['Nueces (crudas)',                  'walnuts raw'],
  ['Avellanas (crudas)',               'hazelnuts raw'],
  ['Anacardos (crudos)',               'cashews raw'],
  ['Pistachos (tostados, sin sal)',    'pistachios dry roasted'],
  ['Cacahuetes (tostados)',            'peanuts dry roasted'],
  ['Nueces de macadamia',             'macadamia nuts raw'],
  ['Nueces de Brasil',                'brazil nuts raw'],
  ['Pipas de girasol (sin sal)',       'sunflower seeds dry roasted'],
  ['Semillas de calabaza',            'pumpkin seeds dried'],
  ['Semillas de chía',                'chia seeds dried'],
  ['Semillas de lino',                'flaxseed raw'],
  ['Semillas de sésamo',              'sesame seeds dried'],
  ['Semillas de cáñamo (corazones)',  'hemp seeds hulled'],
  ['Mantequilla de almendras',        'almond butter plain'],
  ['Mantequilla de cacahuete',        'peanut butter smooth'],
  // Aceites y grasas
  ['Aceite de oliva',                 'olive oil'],
  ['Aceite de coco',                  'coconut oil'],
  ['Aceite de aguacate',              'avocado oil'],
  ['Aceite de girasol',               'sunflower oil'],
  ['Aceite de sésamo',                'sesame oil'],
  ['Ghee (mantequilla clarificada)',  'ghee clarified butter'],
  ['Aceite de linaza',                'flaxseed oil'],
  // Lácteos alternativas vegetales
  ['Leche de avena',                  'oat milk unsweetened'],
  ['Leche de almendras (sin azúcar)', 'almond milk unsweetened'],
  ['Leche de soja (sin azúcar)',      'soy milk unsweetened'],
  ['Leche de coco (para beber)',      'coconut milk beverage unsweetened'],
  // Proteína en polvo
  ['Proteína de suero (whey)',        'whey protein powder'],
  ['Proteína de caseína',             'casein protein powder'],
  ['Proteína de guisante',            'pea protein powder'],
  ['Proteína de arroz',               'rice protein powder'],
  // Dulces y edulcorantes
  ['Miel',                            'honey'],
  ['Sirope de arce',                  'maple syrup'],
  ['Azúcar blanco',                   'white sugar granulated'],
  ['Azúcar moreno',                   'brown sugar packed'],
  ['Chocolate negro 70%',             'dark chocolate 70% cocoa'],
  ['Cacao en polvo (sin azúcar)',     'cocoa powder unsweetened'],
  // Condimentos básicos
  ['Salsa de soja',                   'soy sauce'],
  ['Vinagre de manzana',              'apple cider vinegar'],
  ['Zumo de limón',                   'lemon juice raw'],
];

// Nutrient numbers USDA para los 4 macros
const KCAL_IDS  = new Set(['208', '957']);
const PROT_IDS  = new Set(['203']);
const CARB_IDS  = new Set(['205']);
const FAT_IDS   = new Set(['204']);

function extractMacros(foodNutrients = []) {
  let kcal = null, protein = null, carbs = null, fat = null;
  for (const n of foodNutrients) {
    const num = String(n.number || n.nutrientNumber || '');
    const val = parseFloat(n.amount ?? n.value ?? 0);
    if (KCAL_IDS.has(num)  && kcal    === null) kcal    = val;
    if (PROT_IDS.has(num)  && protein === null) protein = val;
    if (CARB_IDS.has(num)  && carbs   === null) carbs   = val;
    if (FAT_IDS.has(num)   && fat     === null) fat     = val;
  }
  return { kcal, protein, carbs, fat };
}

function usdaGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BASE,
      path,
      method: 'GET',
      headers: { 'User-Agent': 'healthy-app-importer/1.0' },
      timeout: 20000,
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error(`JSON parse error: ${d.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('USDA timeout')); });
    req.end();
  });
}

async function searchUsda(query) {
  const q = encodeURIComponent(query);
  const data = await usdaGet(
    `/fdc/v1/foods/search?query=${q}&dataType=Foundation,SR+Legacy&pageSize=3&api_key=${API_KEY}`
  );
  return data.foods || [];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log(`=== Importación USDA FoodData Central ===`);
  console.log(`API Key: ${API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (límite 50/día — registra clave en api.data.gov para sin límite)' : 'personalizada ✓'}`);
  console.log(`Total de alimentos a importar: ${FOOD_MAP.length}\n`);

  const stats = { imported: 0, skipped: 0, noData: 0, errors: 0 };

  for (let i = 0; i < FOOD_MAP.length; i++) {
    const [spanishName, usdaQuery] = FOOD_MAP[i];

    // Saltar si ya existe
    const exists = await prisma.food.findFirst({ where: { name: spanishName } });
    if (exists) {
      stats.skipped++;
      process.stdout.write(`\r[${i + 1}/${FOOD_MAP.length}] ⏭  ${spanishName.padEnd(40)} — ya existe`);
      continue;
    }

    try {
      const results = await searchUsda(usdaQuery);
      if (!results.length) {
        stats.noData++;
        process.stdout.write(`\r[${i + 1}/${FOOD_MAP.length}] ⚠  ${spanishName.padEnd(40)} — sin resultados USDA`);
        continue;
      }

      const { kcal, protein, carbs, fat } = extractMacros(results[0].foodNutrients);

      if (kcal === null && protein === null) {
        stats.noData++;
        process.stdout.write(`\r[${i + 1}/${FOOD_MAP.length}] ⚠  ${spanishName.padEnd(40)} — sin macros`);
        continue;
      }

      await prisma.food.create({
        data: {
          name:              spanishName,
          calories_per_100g: kcal     ?? 0,
          protein_per_100g:  protein  ?? 0,
          carbs_per_100g:    carbs    ?? 0,
          fat_per_100g:      fat      ?? 0,
          verified:          true,
        },
      });

      stats.imported++;
      process.stdout.write(`\r[${i + 1}/${FOOD_MAP.length}] ✅ ${spanishName.padEnd(40)} — ${kcal?.toFixed(0)} kcal`);

      // Pequeña pausa para no superar rate limit de DEMO_KEY
      await sleep(API_KEY === 'DEMO_KEY' ? 1200 : 200);

    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log('\n⚠️  Límite de API alcanzado. Esperando 60 segundos...');
        await sleep(60000);
        i--; // reintentar este alimento
        continue;
      }
      stats.errors++;
      process.stdout.write(`\r[${i + 1}/${FOOD_MAP.length}] ❌ ${spanishName.padEnd(40)} — ${err.message}`);
    }
  }

  console.log('\n\n=== Resultado ===');
  console.log(`  ✅ Importados   : ${stats.imported}`);
  console.log(`  ⏭  Ya existían : ${stats.skipped}`);
  console.log(`  ⚠️  Sin datos    : ${stats.noData}`);
  console.log(`  ❌ Errores      : ${stats.errors}`);

  if (API_KEY === 'DEMO_KEY' && stats.noData + stats.errors > 0) {
    console.log('\n💡 Para importar más alimentos sin límite diario:');
    console.log('   1. Regístrate gratis en https://api.data.gov/signup/');
    console.log('   2. Recibes clave en tu email en segundos');
    console.log('   3. Ejecuta: USDA_API_KEY=tu_clave node prisma/import-usda.js');
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
