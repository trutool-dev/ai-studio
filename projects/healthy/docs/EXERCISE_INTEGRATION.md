# Integración del catálogo de ejercicios — Healthy

Documento técnico de la Fase 10 (2026-08-28). Describe el pipeline completo de selección de ejercicios reales desde la base de datos para la generación de planes personalizados con Claude.

Dataset fuente: `hasaneyldrm/exercises-dataset` — 1.324 ejercicios reales con GIFs animados.

---

## Pipeline completo: usuario → plan con ejercicios reales

```
+-------------------+
|  Usuario completa  |
|   onboarding      |
+--------+----------+
         |
         | POST /onboarding/complete
         v
+-------------------+
| onboarding.       |
| controller.js     |
|                   |
| 1. Calcula TMB    |
|    y TDEE         |
+--------+----------+
         |
         | perfil del usuario
         v
+----------------------------+
| exerciseSelector           |
| .service.js                |
|                            |
| getExercisesForProfile()   |
| - Filtra por equipamiento  |
| - Filtra por objetivo      |
| - Filtra por dificultad    |
| - Excluye zonas lesionadas |
| - Máximo 80 ejercicios     |
+--------+-------------------+
         |
         | exercises[] (máx 80)
         v
+----------------------------+
| aiService.js               |
|                            |
| buildUserContextPrompt()   |
| - 7 dimensiones onboarding |
| - Métricas TMB/TDEE        |
| + CATÁLOGO DE EJERCICIOS   |
|   (sección nueva Fase 10)  |
+--------+-------------------+
         |
         | prompt con catálogo
         v
+----------------------------+
| Anthropic API              |
| claude-sonnet-4-6          |
| (prompt caching activo)    |
+--------+-------------------+
         |
         | GeneratedPlan JSON
         v
+----------------------------+
| JSON.parse + validación    |
| Persistencia en PostgreSQL |
| Caché Redis (TTL 24h)      |
+----------------------------+
         |
         v
+-------------------+
| GeneratedPlan     |
| devuelto al       |
| frontend          |
+-------------------+
```

El mismo pipeline aplica a `POST /plans/regenerate` a través de `plans.controller.js`.

---

## Componentes nuevos — Fase 10

### 1. Modelo Exercise ampliado (DB-EX-01/02)

**Archivo:** `projects/healthy/backend/prisma/schema.prisma`

Se añadieron 11 campos nuevos al modelo `Exercise` para soportar el dataset externo. Los campos legacy se mantienen como nullable para compatibilidad con registros anteriores.

| Campo | Tipo Prisma | Descripción |
|-------|-------------|-------------|
| `externalId` | `Int? @unique` | ID numérico del dataset (permite upsert) |
| `category` | `String?` | Categoría principal (Arms, Back, Chest, Legs, Shoulders, Waist, Cardio) |
| `bodyPart` | `String?` | Parte del cuerpo específica (upper arm, chest, etc.) |
| `target` | `String?` | Músculo objetivo principal (biceps, pectorals, etc.) |
| `secondaryMuscles` | `String[]` | Array de músculos secundarios trabajados |
| `instructionsEs` | `String?` | Instrucciones en español (texto plano) |
| `instructionsEn` | `String?` | Instrucciones en inglés (texto plano) |
| `gifUrl` | `String?` | URL del GIF animado del ejercicio |
| `thumbnailUrl` | `String?` | URL de imagen estática del ejercicio |
| `equipment` | `String?` | Equipamiento requerido (Body Weight, Dumbbell, Barbell, etc.) |
| `createdAt` | `DateTime` | Fecha de inserción en la base de datos |

Campos legacy mantenidos como nullable: `muscle_group`, `equipment_needed`, `difficulty` (enum ExperienceLevel), `video_url`.

Índices añadidos:
```
@@index([category])
@@index([equipment])
@@index([target])
@@index([bodyPart])
@@index([externalId])
```

### 2. Migración SQL (DB-EX-02)

**Archivo:** `projects/healthy/backend/prisma/migrations/20260828_add_exercise_dataset_fields/migration.sql`

Usa `ALTER TABLE IF NOT EXISTS` para añadir los nuevos campos sin romper la tabla existente. Incluye la creación de todos los índices descritos arriba.

### 3. Script de seed del catálogo (DB-EX-03)

**Archivo:** `projects/healthy/database/seedExercises.js`

Descarga el dataset completo desde GitHub y lo inserta en batches de 100 registros:

```
URL fuente:
https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json
```

Estrategia de inserción:
- `prisma.exercise.createMany({ data: batch, skipDuplicates: true })` en grupos de 100
- `skipDuplicates: true` evita errores por re-ejecución del seed
- Mapeo de campos: `ex.id → externalId`, `ex.instructions → instructionsEs/instructionsEn`
- Log de progreso por batch

Ejecución:
```bash
cd projects/healthy/backend
node ../database/seedExercises.js
```

### 4. Servicio de selección de ejercicios (BE-EX-01)

**Archivo:** `projects/healthy/backend/src/services/exerciseSelector.service.js`

Servicio con dos funciones exportadas:

**`getExercisesForProfile(profile, limit=80)`**

Recibe el perfil del usuario y devuelve hasta `limit` ejercicios filtrados desde PostgreSQL. Si el perfil no es válido o se produce un error de BD, devuelve array vacío (sin propagar el error).

**`formatExercisesForPrompt(exercises)`**

Convierte el array de ejercicios en texto compacto para el prompt de Claude. Formato por ejercicio:
```
- Nombre (ID:externalId)
  Categoría: X | Zona: Y | Equipo: Z
  Músculo objetivo: W
  Músculos secundarios: A, B
  Instrucciones: primeros 150 caracteres...
```

Usa singleton de `PrismaClient` con `PrismaPg(Pool)` para no abrir conexiones duplicadas.

### 5. Endpoint GET /exercises (BE-EX-04)

**Archivo:** `projects/healthy/backend/src/routes/exercises.routes.js`

Registrado en `backend/src/app.js` bajo `/exercises` con rate limiter estándar.

Requiere autenticación mediante el middleware `authenticate`.

---

## Mapeos de filtrado

### Equipamiento (EQUIPMENT_MAP)

| Valor del onboarding | Equipamientos permitidos en el dataset |
|----------------------|----------------------------------------|
| `none` | Body Weight |
| `dumbbells` | Dumbbell, Body Weight |
| `barbell` | Barbell, Dumbbell, Body Weight |
| `gym_full` | Sin filtro (todo el catálogo) |
| `resistance_bands` / `bands` | Band, Body Weight |
| `kettlebells` | Kettlebell, Body Weight |
| `machines` | Sin filtro (todo el catálogo) |
| `full` | Sin filtro (todo el catálogo) |

Cuando el valor es `null` en el mapa, la consulta no aplica filtro de `equipment`.

### Objetivo del usuario (GOAL_TO_CATEGORIES)

| Objetivo del onboarding | Categorías del dataset |
|------------------------|------------------------|
| `weight_loss` / `lose_weight` | Cardio, Waist, Legs, Back |
| `muscle_gain` / `gain_muscle` | Chest, Back, Shoulders, Arms, Legs |
| `strength` | Chest, Back, Legs, Shoulders |
| `endurance` | Cardio, Legs, Back |
| `flexibility` | Waist, Legs, Shoulders |
| `wellness` / `maintain` / `general_health` | Sin filtro (todo el catálogo) |

### Nivel de experiencia (DIFFICULTY_MAP)

| Nivel del onboarding | Dificultades incluidas |
|---------------------|------------------------|
| `beginner` | beginner |
| `intermediate` | beginner, intermediate |
| `advanced` | beginner, intermediate, advanced |

Si el nivel no está mapeado, se usa `intermediate` como fallback.

### Lesiones (INJURY_ZONES)

| Lesión reportada | Músculos/zonas excluidos del filtro `target` |
|-----------------|----------------------------------------------|
| `knee` | quadriceps, hamstrings, calves, glutes |
| `lower_back` | spine, lower back, lats |
| `shoulder` | shoulders, triceps, chest |
| `wrist` | forearms, biceps, triceps |
| `ankle` | calves, hamstrings |
| `neck` | traps, neck |

La exclusión usa `NOT CONTAINS` insensible a mayúsculas sobre el campo `target` del ejercicio.

---

## Actualización del sistema IA (AI-EX-01/02)

### SYSTEM_PROMPT — sección nueva

**Archivo:** `projects/healthy/backend/src/services/aiService.js`

Se añadió la sección `## CATÁLOGO DE EJERCICIOS` con la instrucción prioritaria:

```
REGLA PRIORITARIA — CATÁLOGO DE EJERCICIOS:
Usa ÚNICAMENTE los ejercicios del catálogo proporcionado en el mensaje del usuario.
No inventes ni añadas ejercicios que no estén en esa lista.
Si el catálogo no tiene suficientes ejercicios para completar el plan, reutiliza ejercicios
del catálogo variando series, repeticiones o intensidad.
```

### buildUserContextPrompt — nuevo parámetro `exercises`

La función acepta ahora un cuarto parámetro `exercises=[]`. Cuando `exercises.length > 0`, genera la sección:

```
=== CATÁLOGO DE EJERCICIOS DISPONIBLES ===
Usa SOLO estos ejercicios. Formato: ID | Nombre | Equipamiento | Músculo objetivo | Parte del cuerpo

1 | Push-Up | Body Weight | pectorals | upper body
...
```

Si `exercises` es vacío o nulo, el prompt no incluye la sección (compatibilidad hacia atrás).

Se exportó también `formatExercisesForPrompt(exercises)` como función helper de `aiService.js` para uso en tests.

---

## Integración en controladores (BE-EX-02/03)

### onboarding.controller.js — función `complete()`

Antes de llamar a `generatePlan()`, se obtiene el catálogo:

```js
const exercises = await exerciseSelector.getExercisesForProfile(trainingProfile);
const extraContext = buildRegenerationContext(requestType, recentData);
const plan = await aiService.generatePlan(userId, onboardingData, 'initial', extraContext, exercises);
```

Si `getExercisesForProfile` falla, devuelve array vacío y el plan se genera sin catálogo (fallback silencioso).

### plans.controller.js — función `regeneratePlan()`

Misma integración: `exerciseSelector.getExercisesForProfile()` antes de `aiService.regeneratePlan()`.

---

## Endpoint GET /exercises

### GET /exercises

Devuelve una lista paginada de ejercicios del catálogo real.

**Autenticación:** requerida (Bearer token)

**Query params (todos opcionales):**

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `category` | string | Filtrar por categoría (Arms, Back, Chest, Legs, Shoulders, Waist, Cardio) |
| `equipment` | string | Filtrar por equipamiento (Body Weight, Dumbbell, Barbell, etc.) |
| `difficulty` | string | Filtrar por dificultad (beginner, intermediate, advanced) |
| `target` | string | Filtrar por músculo objetivo |
| `limit` | number | Número de resultados por página (por defecto: 20, máximo: 100) |
| `offset` | number | Número de resultados a saltar (por defecto: 0) |

**Request de ejemplo:**
```
GET /exercises?category=Arms&equipment=Dumbbell&limit=10&offset=0
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "exercises": [
      {
        "id": "uuid-del-ejercicio",
        "externalId": 123,
        "name": "Dumbbell Alternate Biceps Curl",
        "category": "Arms",
        "bodyPart": "upper arm",
        "equipment": "Dumbbell",
        "target": "biceps",
        "secondaryMuscles": ["brachialis", "brachioradialis"],
        "gifUrl": "https://raw.githubusercontent.com/.../123.gif",
        "thumbnailUrl": null
      }
    ],
    "total": 87,
    "limit": 10,
    "offset": 0
  }
}
```

**Errores posibles:**

| Código | Error | Descripción |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Token de acceso no proporcionado o inválido |
| 429 | `RATE_LIMIT` | Demasiadas solicitudes (límite del rate limiter general) |
| 500 | `INTERNAL_ERROR` | Error de base de datos |

### GET /exercises/:id

Devuelve los detalles completos de un ejercicio por su UUID de base de datos.

**Request de ejemplo:**
```
GET /exercises/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Respuesta 200:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "externalId": 123,
    "name": "Dumbbell Alternate Biceps Curl",
    "category": "Arms",
    "bodyPart": "upper arm",
    "equipment": "Dumbbell",
    "target": "biceps",
    "secondaryMuscles": ["brachialis", "brachioradialis"],
    "instructionsEs": "Agarra las mancuernas con las palmas hacia arriba...",
    "instructionsEn": "Grab the dumbbells with your palms facing up...",
    "gifUrl": "https://raw.githubusercontent.com/.../123.gif",
    "thumbnailUrl": null,
    "createdAt": "2026-08-28T00:00:00.000Z"
  }
}
```

**Errores posibles:**

| Código | Error | Descripción |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Token inválido |
| 404 | `NOT_FOUND` | Ejercicio no encontrado |

---

## Estrategia RAG-lite (SQL filtering)

En lugar de usar búsqueda vectorial (embeddings + vector database), el sistema implementa una estrategia de filtrado SQL que denominamos "RAG-lite":

**Diferencias con RAG vectorial:**

| Aspecto | RAG vectorial | RAG-lite (este sistema) |
|---------|---------------|-------------------------|
| Búsqueda | Similitud semántica (cosine distance) | Filtros SQL exactos |
| Infraestructura | pgvector, Pinecone, Weaviate | PostgreSQL estándar |
| Coste de setup | Alto (generación de embeddings) | Bajo (índices normales) |
| Precisión semántica | Alta | Media (basada en metadatos) |
| Velocidad | Media (ANN search) | Alta (índices B-tree) |
| Mantenimiento | Alto (reindexar al actualizar) | Bajo (migraciones Prisma) |

**Justificación de la decisión:**

El catálogo de ejercicios tiene estructura de metadatos bien definida (category, bodyPart, equipment, target). Los filtros del onboarding también son categóricos (equipamiento, objetivo, nivel). La correspondencia entre dimensiones del usuario y atributos del ejercicio es directa y no requiere búsqueda semántica.

El límite de 80 ejercicios por consulta asegura que el contexto de Claude no supere los límites de tokens manteniendo variedad suficiente para el plan.

---

## Estado de tests — resultado final Fase 10

**Total: 317/317 tests pasando | Cobertura: 89.18% líneas**

### Tests nuevos añadidos

| Archivo | Tests | Descripción |
|---------|-------|-------------|
| `tests/unit/exerciseSelector.test.js` | 18 | Lógica de filtrado de exerciseSelector (mocks Prisma) |
| `tests/unit/exercisePrompt.test.js` | 19 | Formateo del catálogo en el prompt de Claude |
| `tests/integration/exercises.routes.test.js` | 27 | Endpoint GET /exercises con Supertest |
| **Total nuevos** | **64** | |

### Configuración Jest

`backend/jest.config.js` — se añadió `modulePaths: ['<rootDir>/node_modules']` para resolución correcta de módulos en el entorno de test.

---

## Archivos creados/modificados en Fase 10

| Archivo | Operación | Descripción |
|---------|-----------|-------------|
| `backend/prisma/schema.prisma` | Modificado | Modelo Exercise con 11 campos nuevos |
| `backend/prisma/migrations/20260828_add_exercise_dataset_fields/migration.sql` | Creado | Migración SQL con ALTER TABLE |
| `database/seedExercises.js` | Creado | Script de seed del catálogo (1.324 ejercicios) |
| `backend/src/services/exerciseSelector.service.js` | Creado | Servicio de selección y filtrado |
| `backend/src/controllers/onboarding.controller.js` | Modificado | Integración del selector en `complete()` |
| `backend/src/controllers/plans.controller.js` | Modificado | Integración del selector en `regeneratePlan()` |
| `backend/src/routes/exercises.routes.js` | Creado | Rutas GET /exercises y GET /exercises/:id |
| `backend/src/app.js` | Modificado | Registro de la ruta `/exercises` |
| `backend/src/services/aiService.js` | Modificado | SYSTEM_PROMPT + parámetro exercises en buildUserContextPrompt |
| `backend/jest.config.js` | Modificado | modulePaths para resolución de módulos |
| `tests/unit/exerciseSelector.test.js` | Creado | 18 tests unitarios |
| `tests/unit/exercisePrompt.test.js` | Creado | 19 tests de prompt |
| `tests/integration/exercises.routes.test.js` | Creado | 27 tests de integración |

---

*Fase 10 completada el 2026-08-28. Commit principal: `40bdb9d`.*
