// Ejecutar desde la raíz del repo: DATABASE_URL=<url> node check-db.js
// SEC-26 (SA-02): la cadena de conexión NUNCA se versiona; se lee del entorno.
// Ver projects/healthy/backend/SECRETS_POLICY.md.
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error(
    'ERROR: la variable de entorno DATABASE_URL no está definida.\n' +
      'Defínela en tu sesión (cópiala de Railway → Postgres → Variables) antes de ejecutar este script.\n' +
      'No la escribas en este archivo ni en ningún otro archivo versionado.'
  );
  process.exit(1);
}

const { PrismaClient } = require(
  path.join(__dirname, 'projects', 'healthy', 'backend', 'node_modules', '@prisma', 'client')
);

const prisma = new PrismaClient();

async function main() {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('\n=== TABLAS ===');
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
