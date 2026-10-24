require('dotenv').config();
const logger = require('./src/utils/logger.util');
const { assertValidEnv } = require('./src/config/env');

// SEC-46 (SA-16 + JB-14): validar la configuración antes de cargar la app.
// En production/staging (o con NODE_ENV inválido) una configuración insegura
// aborta el arranque (fail-closed); en development/test solo se avisa.
try {
  assertValidEnv({ env: process.env, logger });
} catch (err) {
  logger.error(`[server] ${err.message}`);
  process.exit(1);
}

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`[server] Servidor corriendo en puerto ${PORT} — entorno: ${process.env.NODE_ENV}`);
});
