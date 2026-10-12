# PR-1 — Informe de Preparación: `refactor: eliminar archivos duplicados`

**Fecha:** 2026-06-15  
**Agente:** backend  
**Estado:** ✅ Listo para revisión humana — NO se ha eliminado ningún archivo

---

## 1. Cambios realizados

### CLEAN-06 — `src/utils/response.util.js` ampliado

Se añadieron las 6 funciones faltantes. El archivo ahora exporta las 8 funciones requeridas:

| Función | Estado |
|---|---|
| `sendSuccess` | preexistente |
| `sendError` | preexistente |
| `sendCreated` | ✅ añadida |
| `sendNotFound` | ✅ añadida |
| `sendUnauthorized` | ✅ añadida |
| `sendForbidden` | ✅ añadida |
| `sendValidationError` | ✅ añadida |
| `sendServerError` | ✅ añadida |

**Formato adoptado:** se mantiene el formato de `response.util.js` (incluye `error: null` en éxito y `data: null` en error), que difiere ligeramente de `response.js`. Los controladores activos (dot.notation) usan este formato.

### CLEAN-03 — `src/middleware/rateLimiter.middleware.js` ampliado

Se añadieron `apiLimiter` y `planRegenerateLimiter`. El archivo ahora exporta:

| Export | Estado |
|---|---|
| `authRateLimiter` | preexistente |
| `apiLimiter` | ✅ añadido |
| `planRegenerateLimiter` | ✅ añadido |

### CLEAN-03 — `src/routes/plans.routes.js` actualizado

Cambiado el import de `planRegenerateLimiter`:

```diff
- const { planRegenerateLimiter } = require('../middleware/rateLimiter');
+ const { planRegenerateLimiter } = require('../middleware/rateLimiter.middleware');
```

---

## 2. Archivos a eliminar

Una vez que el revisor humano confirme este informe, se pueden eliminar los siguientes archivos. Ninguno es importado por ningún archivo activo (rutas, app.js, controladores dot.notation).

### Controladores camelCase (duplicados)

```
backend/src/controllers/authController.js
backend/src/controllers/logsController.js
backend/src/controllers/nutritionController.js
backend/src/controllers/onboardingController.js
backend/src/controllers/planController.js
backend/src/controllers/progressController.js
backend/src/controllers/trainingController.js
```

### Middlewares muertos

```
backend/src/middleware/auth.js
backend/src/middleware/errorHandler.js
backend/src/middleware/rateLimiter.js
```

### Utilidades duplicadas

```
backend/src/services/emailService.js
backend/src/utils/logger.js
backend/src/utils/response.js
backend/src/utils/prismaClient.js
```

**Total: 14 archivos a eliminar**

---

## 3. Confirmación de cobertura: dot.notation cubre 100% de camelCase

### authController.js → auth.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `register` | `register` | ✅ — dot.notation añade verificación edad 16 años (RGPD) y health consent |
| `verifyEmail` | `verifyEmail` | ✅ |
| `setPassword` | `setPassword` | ✅ |
| `login` | `login` | ✅ |
| `forgotPassword` | `forgotPassword` | ✅ |
| `resetPassword` | `resetPassword` | ✅ |
| `logout` | `logout` | ✅ |
| `refreshToken` | `refresh` | ✅ — renombrado; `auth.routes.js` usa `ctrl.refresh` (dot.notation) |
| `me` | `me` | ✅ |
| *(no existe)* | `resendCode` | ➕ endpoint extra en dot.notation |

**Veredicto: dot.notation es SUPERSET de camelCase ✓**

---

### logsController.js → logs.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `getTodayLog` | `getToday` | ✅ — lógica equivalente; `logs.routes.js` usa `ctrl.getToday` |
| `updateTodayLog` | `updateToday` | ✅ — lógica equivalente |
| `getLogHistory` | `getHistory` | ✅ — dot.notation incluye `steps` en el filtro `withData` (mejora menor) |

**Veredicto: cobertura 100% ✓**

---

### nutritionController.js → nutrition.controller.js + foods.controller.js

Los handlers de búsqueda de alimentos se separaron a `foods.controller.js`:

| Handler camelCase | Handler dot.notation | Archivo | Cobertura |
|---|---|---|---|
| `getTodayMeals` | `getMeals` | nutrition.controller.js | ✅ — añade soporte de parámetro `?date=` |
| `completeMeal` | `completeMeal` | nutrition.controller.js | ✅ |
| `searchFoods` | `searchFoods` | foods.controller.js | ✅ — usa Redis directo (en vez de cacheService) |
| `getFoodByBarcode` | `getFoodByBarcode` | foods.controller.js | ✅ |

**Veredicto: cobertura 100% (separación de concerns correcta) ✓**

---

### onboardingController.js → onboarding.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `saveProfile` | `saveProfile` | ✅ — añade verificación edad 16 años |
| `saveLifestyle` | `saveLifestyle` | ✅ |
| `saveTraining` | `saveTraining` | ✅ |
| `saveNutrition` | `saveNutrition` | ✅ |
| `saveHealth` | `saveHealth` | ✅ — añade registro consentimiento salud RGPD Art.9 |
| `saveMotivation` | `saveMotivation` | ✅ |
| `complete` | `complete` | ✅ — devuelve 201 en lugar de 200 |
| *(no existe)* | `start` | ➕ endpoint extra en dot.notation |

**Veredicto: dot.notation es SUPERSET de camelCase ✓**

---

### planController.js → plans.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `getActivePlan` | `getActivePlan` | ✅ |
| `getPlanById` | `getPlanById` | ✅ |
| `regenerate` | `regeneratePlan` | ✅ — renombrado; `plans.routes.js` usa `ctrl.regeneratePlan` |
| `pausePlan` | `pausePlan` | ✅ |

**Veredicto: cobertura 100% ✓**

---

### progressController.js → progress.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `getProgress` | `getProgress` | ✅ — dot.notation aplica límite máximo de 100 en `limit` |
| `createProgress` | `createProgress` | ✅ — devuelve 201 en lugar de 200 |
| `getProgressStats` | `getStats` | ✅ — renombrado; `progress.routes.js` usa `ctrl.getStats` |

**Veredicto: cobertura 100% ✓**

---

### trainingController.js → training.controller.js

| Handler camelCase | Handler dot.notation | Cobertura |
|---|---|---|
| `getTodaySession` | `getSessions` | ✅ — `training.routes.js` delega `/today` a `getSessions` con `?date=hoy` |
| `getSessionById` | `getSessionById` | ✅ |
| `completeSession` | `completeSession` | ✅ |
| `addExerciseSet` | `completeExercise` | ✅ — renombrado; routes registra ambos alias (`/sets` y `/complete`) |

**Veredicto: cobertura 100% ✓**

---

### middleware/auth.js → middleware/auth.middleware.js

| Export camelCase | Export dot.notation | Cobertura |
|---|---|---|
| `authenticate` | `authenticate` | ✅ — dot.notation usa `req.user = payload` (JWT directo); camelCase mapeaba `req.user.id = decoded.userId`. Todos los dot.notation controllers usan `req.user.userId` (consistente) |

**Veredicto: cobertura 100% ✓**

---

### middleware/errorHandler.js → middleware/errorHandler.middleware.js

| Export camelCase | Export dot.notation | Cobertura |
|---|---|---|
| `errorHandler` | `errorHandler` (default export) | ✅ — ambos manejan P2002, P2025 y error genérico |
| `notFoundHandler` | *(no existe)* | ✅ — `app.js` maneja 404 inline; `notFoundHandler` nunca fue registrado en `app.js` activo |

**Veredicto: cobertura 100% ✓**

---

### services/emailService.js → services/email.service.js

Ambos exportan `sendVerificationEmail` y `sendPasswordResetEmail`. El activo es `email.service.js` (usado por `auth.controller.js`). `emailService.js` solo era usado por los controladores camelCase.

**Veredicto: cobertura 100% ✓**

---

### utils/logger.js → utils/logger.util.js

Ambos crean un logger winston. `logger.util.js` usa formato JSON en todos los entornos. `logger.js` tenía formato colorizado en desarrollo. La funcionalidad es equivalente.

**Veredicto: cobertura 100% ✓**

---

### utils/prismaClient.js → prisma/client.js

Ambos exportan un singleton de `PrismaClient`. `prisma/client.js` importa desde el cliente generado local (`../generated/prisma`) en lugar del paquete global `@prisma/client`.

**Veredicto: cobertura 100% ✓**

---

## 4. Verificación de imports activos

Ningún archivo activo (routes, app.js, controladores dot.notation) importa los archivos a eliminar, excepto el caso ya corregido en `plans.routes.js`.

**Resultado del grep post-corrección:**

```bash
# Verificar que no hay imports a archivos camelCase en archivos activos:
grep -r "authController\|logsController\|nutritionController\|onboardingController\|planController\|progressController\|trainingController" backend/src/routes/
# → 0 resultados

grep -r "middleware/rateLimiter'" backend/src/routes/
# → 0 resultados (plans.routes.js ya corregido)

grep -r "utils/response'\|utils/logger'\|utils/prismaClient'\|services/emailService'" backend/src/routes/ backend/src/middleware/*middleware* backend/src/controllers/*.controller.js
# → 0 resultados
```

---

## 5. Riesgos y excepciones

### 🟡 RIESGO: req.user.id vs req.user.userId

**Descripción:** Los controladores camelCase usan `req.user.id` (mapeado en `auth.js`). Los dot.notation usan `req.user.userId` (del payload JWT directo via `auth.middleware.js`). El sistema activo es coherente con dot.notation; tras eliminar los archivos camelCase, este riesgo desaparece.

**Mitigación:** El sistema activo (`app.js` + dot.notation routes + dot.notation controllers) es internamente consistente. No hay mezcla.

---

### 🟡 RIESGO: services/aiService.js

**Descripción:** `services/aiService.js` (sin sufijo) es utilizado por **ambos** sistemas: los controladores camelCase (que se eliminarán) y los controladores dot.notation (activos). Este archivo **NO debe eliminarse**.

**Estado:** `aiService.js` NO está en la lista de archivos a eliminar. ✓

---

### 🟢 SIN RIESGO: validate.js y validate.middleware.js

Ambos permanecen intactos. Su eliminación se decide en PR-4. La nota del PR-1 explica que `middleware/validate.js` (Zod) se mantiene hasta que PR-4 decida la estrategia de validación.

---

### 🟢 SIN RIESGO: services/cacheService.js

`services/cacheService.js` es usado por `authService.js` (activo) y por `nutritionController.js` (a eliminar). No hay conflicto: los controladores dot.notation usan `redis.service.js` directamente. `cacheService.js` permanece para uso de `authService.js`.

---

## 6. Criterios de aceptación de PR-1 — estado actual

| Criterio | Estado |
|---|---|
| `response.util.js` exporta las 8 funciones | ✅ completado |
| `rateLimiter.middleware.js` exporta `planRegenerateLimiter` | ✅ completado |
| `plans.routes.js` importa desde `rateLimiter.middleware` | ✅ completado |
| Cada archivo dot.notation cubre 100% su equivalente camelCase | ✅ verificado |
| Ningún archivo activo importa los archivos a eliminar | ✅ verificado |

**Pendiente tras aprobación humana:**
- [ ] Eliminar los 14 archivos listados en la sección 2
- [ ] Ejecutar `npm test` en `backend/` para confirmar 0 tests rotos
- [ ] Verificar `GET /health` devuelve 200
- [ ] Ejecutar `grep -r "authController\|logsController\|emailService\|prismaClient" backend/src` → debe devolver 0 resultados
