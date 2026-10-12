const Redis = require('ioredis');
const logger = require('../utils/logger.util');

// En test, Redis falla instantáneamente (sin reintentos ni delays)
// para evitar timeouts en los beforeAll de los tests de integración
const redisOptions = process.env.NODE_ENV === 'test'
  ? {
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      retryStrategy: () => null, // sin reconexión automática
    }
  : {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    };

const redis = new Redis(process.env.REDIS_URL, redisOptions);

redis.on('connect', () => logger.info('[redis] Conexión establecida'));
redis.on('error', (err) => logger.error(`[redis] Error: ${err.message}`));

module.exports = redis;
