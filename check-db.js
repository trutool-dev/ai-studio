// Ejecutar desde: node C:\Users\Antonio\Documents\ai-studio\check-db.js
process.env.DATABASE_URL = 'postgresql://postgres:uafKvfChkeiZYylgsppDWifuNAYjsdPx@thomas.proxy.rlwy.net:25732/railway';

const { PrismaClient } = require('C:/Users/Antonio/Documents/ai-studio/projects/healthy/backend/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('\n=== TABLAS EN PRODUCCION ===');
  tables.forEach(r => console.log(' -', r.table_name));

  const cols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name LIKE '%consent%'"
  );
  console.log('\n=== COLUMNAS consent en users ===');
  if (cols.length === 0) console.log(' (ninguna — columna NO existe)');
  else cols.forEach(r => console.log(' -', r.column_name));
}

main()
  .catch(e => console.log('ERROR:', e.message))
  .finally(() => prisma.$disconnect());
