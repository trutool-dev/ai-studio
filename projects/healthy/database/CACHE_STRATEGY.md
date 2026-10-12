# Cache Strategy — Healthy App (Redis)

## Resumen

La estrategia de caché de Healthy usa Redis como capa intermedia entre
la API (Node.js/Express) y PostgreSQL. El objetivo es reducir la latencia
en lecturas frecuentes y aliviar la carga de la base de datos para datos
que cambian poco.

---

## Qué se cachea y por qué

| Dato | ¿Por qué cachearlo? | Frecuencia de lectura | Frecuencia de cambio |
|------|--------------------|-----------------------|----------------------|
| Plan IA del usuario | Generación costosa (llamada a Claude API). Los planes no cambian durante el día | Alta (cada apertura de app) | Baja (1 vez/día máx.) |
| Perfil del usuario | Se lee en cada petición autenticada para personalizar respuestas | Muy alta | Baja (el usuario raramente edita su perfil) |
| Refresh token / sesión | Verificar sesiones en cada petición autenticada | Muy alta | Moderada (caducidad natural) |
| Preferencias nutricionales | Se usan para generar planes y filtrar alimentos | Alta | Muy baja |
| Preferencias de entrenamiento | Se usan para generar planes y sugerir ejercicios | Alta | Muy baja |

---

## TTLs y justificación

| Clave | TTL | Justificación |
|-------|-----|---------------|
| `plan:{userId}:{date}` | **86400s (24h)** | Un plan IA se genera una vez al día. Pasadas 24h es un día nuevo y se regenera automáticamente |
| `session:{sessionId}` | **2592000s (30 días)** | Los refresh tokens duran 30 días según la política de seguridad. El TTL de Redis refleja este tiempo máximo |
| `user:{userId}:profile` | **3600s (1h)** | El perfil se actualiza raramente. Una hora de stale data es aceptable y reduce carga en DB |
| `user:{userId}:nutrition_prefs` | **21600s (6h)** | Las preferencias nutricionales prácticamente no cambian. 6h es un buen equilibrio |
| `user:{userId}:training_prefs` | **21600s (6h)** | Idem que preferencias nutricionales |
| `rate_limit:login:{email}` | **900s (15 min)** | Ventana de rate limiting para intentos de login fallidos (máx. 5 en 15min) |

---

## Estructura de claves Redis

```
# Plan IA (generado por Claude)
plan:{userId}:{YYYY-MM-DD}
Ejemplo: plan:a1b2c3d4:2026-06-07

# Sesión activa (refresh token + metadata)
session:{sessionId}
Ejemplo: session:f9e8d7c6-b5a4-3210-9876-fedcba098765

# Perfil completo del usuario
user:{userId}:profile
Ejemplo: user:a1b2c3d4:profile

# Preferencias nutricionales
user:{userId}:nutrition_prefs
Ejemplo: user:a1b2c3d4:nutrition_prefs

# Preferencias de entrenamiento
user:{userId}:training_prefs
Ejemplo: user:a1b2c3d4:training_prefs

# Rate limiting de login
rate_limit:login:{email}
Ejemplo: rate_limit:login:user@example.com
```

### Convención de nombres

- **Separador**: `:` (dos puntos)
- **Entidad principal**: primera parte (`plan`, `session`, `user`, `rate_limit`)
- **Identificador**: segunda parte (siempre UUID del usuario/sesión)
- **Subtipo**: tercera parte cuando aplica (fecha, `profile`, `nutrition_prefs`, etc.)
- **Sin mayúsculas**: todo en minúsculas
- **Sin espacios**: usar guiones bajos en los subtipos compuestos

---

## Estrategia de invalidación

### Cache-Aside (patrón principal)

La app usa el patrón **Cache-Aside**:
1. La API solicita datos → primero busca en Redis
2. Si hay hit → devuelve el valor cacheado
3. Si hay miss → consulta PostgreSQL, guarda en Redis, devuelve el resultado

```
GET /user/profile
  → getCache("user:abc123:profile")
  → HIT: devolver datos de Redis
  → MISS: consultar DB → setCache → devolver datos
```

### Invalidación por evento

Cuando el usuario actualiza sus datos, se invalida proactivamente la caché:

| Evento | Claves invalidadas |
|--------|-------------------|
| Usuario edita perfil | `user:{userId}:profile` |
| Usuario cambia preferencias nutricionales | `user:{userId}:nutrition_prefs` |
| Usuario cambia preferencias de entrenamiento | `user:{userId}:training_prefs` |
| Cualquier cambio de perfil/prefs | `plan:{userId}:*` (todos los planes del día) |
| Logout de sesión | `session:{sessionId}` |
| Reset de contraseña | Todas las sesiones del usuario + perfil |

### Invalidación masiva de usuario

La función `invalidateUserCache(userId)` elimina de una sola llamada:
- `user:{userId}:profile`
- `user:{userId}:nutrition_prefs`
- `user:{userId}:training_prefs`
- Todos los `plan:{userId}:*` (via KEYS + DEL batch)

> **Nota:** El uso de `KEYS` es aceptable en este contexto porque
> el número de planes por usuario es siempre pequeño (max 1 por día).
> Para producción con alto volumen, considerar Redis Sets para tracking de claves.

### Expiración natural (TTL)

Para datos como el perfil de usuario, la expiración natural (TTL) es
suficiente como estrategia secundaria. Si se produce stale data durante
una hora para datos de perfil, el impacto funcional es mínimo.

---

## Consideraciones de seguridad

- Los **tokens de sesión** se almacenan en Redis con su TTL. Si un token es comprometido, se puede invalidar llamando a `invalidateSession(sessionId)`.
- **Nunca** se cachea `password_hash` ni datos de verificación OTP en Redis.
- Los códigos OTP tienen TTL de 15 minutos y se marcan como `used_at` en PostgreSQL; no pasan por Redis.
- En caso de flush de Redis, la app degrada graciosamente: consulta la DB directamente sin interrumpir el servicio.

---

## Configuración de Redis recomendada

```conf
# redis.conf (producción)
maxmemory 256mb
maxmemory-policy allkeys-lru       # Elimina las claves menos usadas cuando hay presión de memoria
appendonly yes                     # Persistencia AOF para durabilidad básica
save 900 1                         # Snapshot RDB adicional
```

### Docker Compose (desarrollo)

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --maxmemory 128mb --maxmemory-policy allkeys-lru
  volumes:
    - redis_data:/data
```

---

## Monitorización

Métricas clave a observar en producción:

| Métrica | Comando Redis | Objetivo |
|---------|--------------|---------|
| Hit rate | `INFO stats` → `keyspace_hits / (keyspace_hits + keyspace_misses)` | > 85% |
| Memoria usada | `INFO memory` → `used_memory_human` | < 80% del límite |
| Claves expiradas | `INFO stats` → `expired_keys` | Monitorizar picos |
| Conexiones activas | `INFO clients` → `connected_clients` | < 100 para dev |

---

*Última actualización: 2026-06-07*
