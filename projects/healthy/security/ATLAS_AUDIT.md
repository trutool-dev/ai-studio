# Auditoría MITRE ATLAS — Proyecto Healthy (renovación)

> **Nota del orquestador (2026-10-19):** los IDs provisionales SA-xx / JB-xx de este informe se han consolidado como **SEC-25..SEC-72** en `SECURITY_TASKS.md` (columna "Origen"). Resumen ejecutivo: `AUDIT_SUMMARY_2026-10-19.md`.

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19 |
| Auditor | Agente JailBreak (Claude Opus 5.5) — revisión independiente |
| Commit auditado | `4993123` (rama `develop`) |
| Marco | MITRE ATLAS v4.5 + OWASP LLM Top 10 (2025) — ver `LLM_THREATS.md` |
| Método | Auditoría **estática** del código. Sin llamadas a la API de Anthropic, sin peticiones a staging ni a producción. No se han generado payloads funcionales |
| Auditoría previa | `projects/healthy/auditoria_atlas_mitre.md` (2026-10-12, SEC-01..SEC-24) |
| Documentos relacionados | `LLM_THREATS.md` (matriz OWASP + modelo de amenazas), `PROMPT_REVIEW.md` (prompts y pruebas propuestas) |

## Alcance revisado

- IA: `backend/src/services/aiService.js` (servicio que se despliega), `backend/src/services/exerciseSelector.service.js`, `backend/src/utils/crypto.util.js`, `backend/src/services/redis.service.js`, `backend/src/services/cacheService.js`.
- Flujos que llaman a Claude: `backend/src/controllers/onboarding.controller.js` (`complete`), `backend/src/controllers/plans.controller.js` (`regeneratePlan`), `backend/src/app.js` (`/health/ai`).
- Controles: `backend/src/middleware/rateLimiter.middleware.js`, `backend/src/routes/onboarding.routes.js`, `backend/src/routes/plans.routes.js`, `backend/src/routes/auth.routes.js`, `backend/src/middleware/errorHandler.middleware.js`, `backend/server.js`.
- Frontend: pantallas de onboarding (`frontend/src/screens/onboarding/*.tsx`), `ProfileScreen`, `ProgressScreen`, `planStore.ts`.
- Código nuevo posterior al 2026-10-12: A-6 micronutrientes (`foods.controller.js`, `import-usda`), N-1 (`nutrition.controller.js` `addFoodToMeal`), A-9 (`user.controller.js` `getProfile`), A-15/A-16 (`has_plan`).
- Código IA no desplegado: `ai/planGenerator.ts`, `src/prompts/planPromptBuilder.js`, `src/services/planGeneratorService.js` (raíz del proyecto).
- Commits de corrección verificados con `git show`: `cb66d48`, `3930265`, `1281dce`, `dd9e9f7`. `aiService.js` no ha cambiado desde `cb66d48`.

## Resumen ejecutivo

**Conclusión:** las 24 tareas SEC están marcadas como hechas en `PROJECT_STATUS.md`, pero solo 7 aguantan la revisión. 13 son parciales o se pueden eludir y 4 no funcionan en la práctica. El hallazgo más grave no es de jailbreak, sino de **integridad del contexto**: por un desajuste entre lo que envía el frontend y lo que espera el backend, **las alergias, intolerancias, lesiones y condiciones médicas que declara el usuario nunca llegan al prompt**. El plan de respaldo, además, incluye frutos secos y lácteos de forma fija. El mismo desajuste permite **saltarse la comprobación de edad mínima de 16 años**.

### Estado de SEC-01..SEC-24

| Estado | Nº | IDs |
|---|---|---|
| ✅ Verificada | 7 | SEC-02, SEC-04, SEC-09, SEC-12*, SEC-13, SEC-21, SEC-22 |
| ⚠️ Parcial / eludible | 13 | SEC-01, SEC-05, SEC-06, SEC-07, SEC-08, SEC-10, SEC-11, SEC-14, SEC-15, SEC-16, SEC-17, SEC-18, SEC-19 |
| ❌ No efectiva / regresión | 4 | SEC-03, SEC-20, SEC-23, SEC-24(c-d)** |

\* SEC-12 cumple el límite de 50 kb. La validación de longitud por campo solo se aplica al construir el prompt, no al guardar (ver nota).
\*\* SEC-24 tiene la política documentada, pero el hook es solo local y no revisa `.md`. Se clasifica ❌ en la parte técnica (c-d); en la tabla figura como ⚠️/❌.

### Hallazgos nuevos (JB-nn)

| Severidad | Nº | IDs |
|---|---|---|
| 🔴 CRÍTICO | 2 | JB-01, JB-02 |
| 🟠 ALTO | 7 | JB-03 … JB-09 |
| 🟡 MEDIO | 7 | JB-10 … JB-16 |
| 🟢 BAJO | 4 | JB-17 … JB-20 |
| **Total** | **20** | |

**Bloquean el deploy a producción:** JB-01 y JB-02 (🔴). Además, se recomienda fuertemente resolver JB-04, JB-07 y JB-09 antes de abrir el registro público.

### Código posterior al 2026-10-12: ¿alimenta a la IA?

| Funcionalidad | ¿Llega al prompt? | Evidencia |
|---|---|---|
| A-6 micronutrientes (`Food`) | No | `buildUserContextPrompt` no lee `Food` (`aiService.js:232-329`). Los micronutrientes solo se sirven en `foods.controller.js` |
| N-1 `POST /nutrition/meals/:mealId/foods` | No | `nutrition.controller.js:58-107` solo crea `MealFood` y recalcula macros. Ninguna ruta IA lee `meal_foods`. No hay inyección indirecta almacenada por esta vía |
| A-9 `GET /user/me/profile` | No | `user.controller.js:206-229`, solo lectura |
| A-15/A-16 `has_plan` | No influye en la generación | Solo decide la navegación en el cliente (`RootNavigator.tsx:75`). El servidor no lo usa para autorizar la generación. Si se manipula en SecureStore, solo vuelve a mostrar el onboarding, que sigue limitado por `planGenerationLimiter` |
| Notas de progreso (`progress_logs.notes`) | No | `regeneratePlan` solo pasa `log_date`/`weight_kg` y `aiService.regeneratePlan` ni siquiera usa `progressLogs` (`aiService.js:546-570`) |

---

## Tabla de verificación SEC-01..SEC-24

| ID | Hallazgo ATLAS original | Técnica | Estado | Evidencia (archivo:línea) | Cómo se elude / qué falta |
|---|---|---|---|---|---|
| SEC-01 | Prompt injection en los campos de onboarding | AML.T0051 | ⚠️ | `aiService.js:168-192` (lista negra + truncado), `:244`/`:308` (`<user_data>`), `:154-159` (instrucciones defensivas) | Lista negra de 6 patrones, solo en inglés: las reformulaciones, el español y los sinónimos pasan. No filtra ni escapa `</user_data>` ni `<`/`>`, así que se puede cerrar el delimitador antes de tiempo (JB-06). El texto filtrado se sustituye y luego se trunca, pero el contenido sigue dentro del prompt. Mitigación real: separación de roles más validación de salida (JB-04) |
| SEC-02 | `extraContext` libre desde el cliente | AML.T0051.001 | ✅ | `plans.controller.js:60` (solo `reason`), `aiService.js:549-562` (`switch` con valores fijos; `default` usa texto fijo) | Correcto: el cliente no controla texto del prompt. Nota menor: `reason` se guarda sin validar en `plan.ai_prompt_used` (`plans.controller.js:122`), lo que es higiene de datos y no inyección |
| SEC-03 | Inyección indirecta vía catálogo externo | AML.T0051.002 | ❌ (regresión funcional) | `aiService.js:197-224` (`sanitizeExerciseForPrompt`/`formatExercisesForPrompt`) **nunca se ejecuta en producción**: `onboarding.controller.js:284` y `aiService.js:569` pasan el catálogo como `extraContext` (4º parámetro) y `exercises` siempre queda `[]` | El catálogo se formatea con `exerciseSelector.formatExercisesForPrompt` (`exerciseSelector.service.js:177-197`, sin sanitizar caracteres de control) y luego pasa por `sanitizeTextField(extraContext, 500)` (`aiService.js:312`). Eso elimina los saltos de línea y lo **trunca a 500 caracteres**, de modo que el modelo recibe 2-4 ejercicios en una sola línea, en una sección con autoridad de servidor, fuera de `<user_data>`. La inyección se reduce como efecto secundario, pero el control diseñado está muerto y el catálogo no funciona (JB-10) |
| SEC-04 | `userId` del JWT frente al body | AML.T0057 | ✅ | `plans.controller.js:59-71`, `onboarding.controller.js:160-171` (todo se consulta con `req.user.userId`) | Correcto. La clave de caché `plan:${userId}:${fecha}` (`aiService.js:454`) usa el `userId` del JWT, así que no hay fuga entre usuarios |
| SEC-05 | DoS de la API key con cuentas masivas | AML.T0029 | ⚠️ | `rateLimiter.middleware.js:44-51`, `auth.routes.js:14` | `keyGenerator: req.ip` sin `app.set('trust proxy')` (no existe en `app.js` ni en `server.js`). Detrás del proxy de Railway, la IP es la del proxy y el límite pasa a ser **global**: 3 registros/hora para toda la app, lo que es un DoS del registro. Un atacante con X-Forwarded-For no lo elude, pero bloquea a todos. MemoryStore: se reinicia en cada deploy. El presupuesto y las alertas de gasto en Anthropic no se pueden verificar en el código. Ver JB-07 |
| SEC-06 | Coste por usuario autenticado | AML.T0040 / T0034 | ⚠️ | `rateLimiter.middleware.js:54-62` (1 plan/día) y `:34-41` (3 regeneraciones/día), aplicados en `onboarding.routes.js:91` y `plans.routes.js:11` | Límites en memoria: se reinician en cada deploy (Railway despliega en cada push) y no se comparten entre réplicas. Las **métricas de tokens por userId y la alerta de 50k/día no existen**: `TokenUsageLog` no se escribe nunca desde el backend (solo se borra en `user.controller.js:26`) y no se lee `response.usage` (JB-12) |
| SEC-07 | Defensas anti-jailbreak y validación de estructura | AML.T0054 | ⚠️ | Instrucciones en `aiService.js:154-159` ✅. Validación: `aiService.js:510-519` | Solo hay `JSON.parse` y saneado de 3 campos. **No se valida el esquema** `{training_plan, nutrition_plan}`: si faltan, `onboarding.controller.js:291` lanza TypeError y devuelve 500. Si `weeks` es enorme, se ejecutan bucles y escrituras masivas (JB-04). `zod` está en `package.json` pero no se usa |
| SEC-08 | Fuga de errores de Claude al cliente | AML.T0065 | ⚠️ | `aiService.js:526-535` (registra `err.message`/`status`, el cliente recibe el plan de respaldo) ✅. `errorHandler.middleware.js:22` respuesta genérica ✅ | `/health/ai` devuelve `err.message` y `err.status` de Anthropic al cliente (`app.js:81`) (JB-08) |
| SEC-09 | Confidencialidad del system prompt | AML.T0056 | ✅ | `aiService.js:157` (instrucción), `:162` (opción por variable de entorno) | Correcto como mitigación blanda. Nota: `AI_SYSTEM_PROMPT` **sustituye por completo** el prompt, incluidas las reglas de seguridad, sin validación (JB-17). La confidencialidad del prompt no es una defensa: no debe contener secretos (no los contiene) |
| SEC-10 | Cifrado en reposo de planes en Redis | AML.T0035 | ⚠️ | `crypto.util.js:43-68` (AES-256-GCM correcto, IV de 12 bytes y authTag), `aiService.js:424-435`, `:461-482` | **Falla en abierto:** si `REDIS_ENCRYPTION_KEY` falta o tiene menos de 32 caracteres, guarda en claro sin avisar (`crypto.util.js:44`). Al descifrar, un valor sin `:` se acepta como texto plano (`:57`). No hay comprobación al arrancar. No existe el log de auditoría de accesos. No se puede verificar si las variables están definidas en Railway (JB-14) |
| SEC-11 | Exfiltración en campos de texto libre de la salida | AML.T0024 | ⚠️ | `aiService.js:512-519` | Solo se tratan `notes` (raíz), `generated_at` y `model_version`. `...parsed` copia cualquier otro campo. `weekly_schedule[].notes`, `exercises[].instructions`, `meal_suggestions[].description` e `ingredients` no tienen límite ni validación. `daySession.notes` se guarda en BD sin truncar (`plans.controller.js:140`, `onboarding.controller.js:319`) y `generated_plan` se devuelve entero al cliente (`onboarding.controller.js:370`, `plans.controller.js:163`) (JB-04) |
| SEC-12 | Inflado de prompt / límite JSON | AML.T0034 | ✅ (parcial en validación) | `app.js:54` (`50kb`). Truncado por campo en el prompt: `aiService.js:236-241` (presupuesto de 2000) | El límite global está bien. No hay longitud máxima por campo en las rutas (`onboarding.routes.js`): `profession`, `injuries_or_limitations`, `condition_name`, `food_name` y `notes` se guardan sin límite (hasta ~50 kb cada uno). En el prompt se truncan, así que el coste está acotado. `express.urlencoded` sin `limit` (100 kb por defecto) |
| SEC-13 | Supply chain / auditoría en CI | AML.T0010 | ✅ | `.github/workflows/security-audit.yml` (`npm audit --production --audit-level=high`), `.github/dependabot.yml`, `backend/package.json:23` (`"0.52.0"` fijado) | Correcto. Nota: `backend/package-lock.json:11` mantiene `"^0.52.0"` en la raíz del lock (no está regenerado). Ver JB-16 sobre la PR de dependabot a 0.133 |
| SEC-14 | Documentación interna en un repo público | AML.T0000 | ⚠️ | `.gitignore` (raíz, commit `1281dce`) | `.gitignore` no saca del índice los archivos ya versionados: `CLAUDE.*.md`, `PR-*.md`, `PROJECT_STATUS.md` y `*_AUDIT.md` siguen en git (`git ls-files`). Además, el patrón `*_AUDIT.md` **ignora este mismo `ATLAS_AUDIT.md`**, que habrá que añadir con `git add -f`. `projects/healthy/.gitignore` ignora `app.json`, que está versionado (JB-20) |
| SEC-15 | Integridad del catálogo externo | AML.T0019 | ⚠️ | `exerciseSelector.service.js:76-90` | Solo trunca y elimina U+00AD y U+202A-U+202E. No elimina saltos de línea, caracteres de control, U+2066-U+2069 ni anchos cero. No valida el esquema ni la procedencia (hash). El riesgo residual es bajo porque el catálogo se trunca a 500 caracteres (ver SEC-03) |
| SEC-16 | HMAC de integridad en caché | AML.T0070 | ⚠️ | `aiService.js:430`, `:465-476`, `crypto.util.js:75-78` | Falla en abierto si `REDIS_HMAC_SECRET` no está definido. Si el valor no contiene `:`, se acepta sin verificar (`:465`). Compara con `===` en vez de `crypto.timingSafeEqual`. Con cifrado GCM activo, el HMAC aporta poco (GCM ya autentica). El riesgo real depende de que el atacante tenga escritura en Redis (red privada de Railway) (JB-14) |
| SEC-17 | Normalización Unicode / evasión | AML.T0015 | ⚠️ | `aiService.js:186-188` | Usa **NFC y no NFKC**: los caracteres de ancho completo y las ligaduras se mantienen y evitan los regex. No elimina anchos cero (U+200B-U+200D, U+2060) ni U+00AD (guion suave): una palabra partida con un ancho cero evita cualquier patrón. Sin detección de Base64/leet. Los homóglifos (cirílico) no se tratan (JB-06) |
| SEC-18 | Ofuscación entre campos | AML.T0068 | ⚠️ | `aiService.js:247-306` (separadores `---SECCIÓN---`), `:236-241` (presupuesto de 2000) | Implementado. Los separadores y `<user_data>` se pueden falsificar desde un campo: los `\n` se eliminan (ayuda), pero las marcas en línea no se escapan. El presupuesto común de 2000 se reparte en orden y un campo temprano largo deja sin espacio a las restricciones alimentarias posteriores (las restricciones se truncan a 0: pérdida de seguridad clínica). Hay que priorizar alergias y lesiones (JB-06) |
| SEC-19 | `/health/ai` expone información | AML.T0069 | ⚠️ | `app.js:62-83` | `key_prefix` eliminado ✅. Pero: (a) el bloqueo depende de `NODE_ENV === 'production'`; staging usa `NODE_ENV=staging` (`devops/infrastructure/staging.md:54`), así que queda **expuesto en staging**; (b) `ADMIN_TOKEN` es **opcional**: si no está definido, el endpoint queda abierto (`app.js:66`); (c) comparación no constante; (d) **cada GET hace una llamada real a Anthropic** sin rate limit (no pasa por `apiLimiter`); (e) devuelve `err.message`/`status`. Ver JB-08 |
| SEC-20 | Rangos fisiológicos | AML.T0031 | ❌ | `aiService.js:47-50` (solo limita el cálculo) | No se rechaza con 400: `onboarding.routes.js:19-20` solo exige `> 0`. En el flujo real (JB-02) el perfil se crea en `onboarding.controller.js:178-188` **sin ninguna validación**. El prompt recibe los valores sin limitar (`aiService.js:253-255`), por ejemplo un peso absurdo o un IMC muy bajo, y el modelo decide. La tarea pedía rechazar |
| SEC-21 | `X-Powered-By` | AML.T0003 | ✅ | `app.js:27-41` (Helmet lo desactiva) | Correcto |
| SEC-22 | TTL del JWT | AML.T0047 | ✅ | `auth.controller.js:21`, `authService.js:59` (`JWT_EXPIRES_IN \|\| '15m'`) | Correcto si `JWT_EXPIRES_IN` no está definido con un valor largo en Railway (no verificable). Coincide con el ámbito del agente security |
| SEC-23 | IDs de ejercicios alucinados | AML.T0062 | ❌ | `plans.controller.js:102-113` | (a) Solo existe en regeneración, no en onboarding. (b) El esquema JSON del system prompt (`aiService.js:97-105`) **no tiene campo `id`**, así que `ex.id` no existe y `if (!ex.id) return true` (`:108`) conserva todo. (c) El catálogo llega truncado (SEC-03) y el modelo inventa. Mitigación de hecho: las sesiones guardadas usan el catálogo real por rotación (`plans.controller.js:151-158`), no los ejercicios del modelo |
| SEC-24 | Rotación de secretos / hook de detección | AML.T0055 | ⚠️ / ❌ | `backend/SECRETS_POLICY.md` (política ✅), `.husky/pre-commit` | El hook solo actúa si `core.hooksPath=.husky` (configurado en local, no se impone en CI ni para otros clones). **Excluye `*.md` y `*example*`**, justo donde se pegan claves en la documentación. Solo detecta el patrón de claves de Anthropic. La rotación no es verificable. Recomendación: gitleaks/secret scanning en CI (ámbito security) |

---

## Hallazgos nuevos por táctica ATLAS

> Asignación de agente: `ai` = lógica de prompts, sanitización, validación de salida y cliente Anthropic en `backend/src/services/aiService.js`; `backend` = controladores, rutas, middleware y configuración; `frontend` = app Expo; `orquestador` = higiene del repositorio y coordinación.

### AML.TA0011 Impact / AML.T0048 External Harms (daño físico y de seguridad a usuarios)

#### JB-01 — Alergias, intolerancias, lesiones y condiciones médicas nunca llegan al prompt 🔴
- **Técnica:** AML.T0048 External Harms (User Harm). Relacionado: OWASP LLM09 Misinformation y LLM05.
- **Archivos:** `frontend/src/screens/onboarding/OnboardingNutrition.tsx:36-40` (envía `restrictions`, `budget`), `OnboardingHealth.tsx:50-54` (envía `conditions: string[]` e `injuries`), `OnboardingTraining.tsx:33-37` (envía `days_per_week`, `equipment`, `experience`); `backend/src/routes/onboarding.routes.js:45` (`available_days_per_week` obligatorio), `:69` (`conditions.*.condition_name` obligatorio, lo que exige objetos), `:73-76` (`food_restrictions`); `backend/src/controllers/onboarding.controller.js:99` (ignora `restrictions`), `:178-207` (`complete` solo reconstruye profile/training/nutrition con `diet_type`); `aiService.js:285-300`; plan de respaldo `aiService.js:390-393` (yogur con nueces y avena de forma fija).
- **Descripción:** el contrato frontend↔backend no coincide. `PUT /onboarding/training` y `PUT /onboarding/health` fallan con 400 en la validación y `PUT /onboarding/nutrition` acepta pero descarta `restrictions`. El frontend ignora el error (JB-03). `POST /onboarding/complete` solo guarda perfil, entrenamiento sin lesiones y `diet_type`. Por tanto `food_restrictions`, `health_conditions` e `injuries_or_limitations` quedan vacíos en BD y el prompt no incluye las secciones "RESTRICCIONES ALIMENTARIAS (RESPETAR)", "LESIONES" ni "SALUD". El system prompt promete respetar las alergias, pero el modelo no las recibe. El plan de respaldo, usado ante cualquier error de la API, sugiere frutos secos y lácteos a todos. Hay un efecto secundario del mismo desajuste: si el usuario elige dieta `keto` u `other` en el frontend, el valor no existe en el enum `DietType` (`backend/prisma/schema.prisma`, enum DietType). El PUT falla con 400 y después `/complete` intenta guardarlo (`onboarding.controller.js:200-206`), Prisma lanza una excepción y la respuesta es **500**: esos usuarios no pueden terminar el onboarding.
- **Impacto:** un usuario alérgico a frutos secos o marisco, o con cardiopatía o lesión de rodilla, recibe menús o ejercicios contraindicados. Puede haber daño físico, responsabilidad legal y riesgo reputacional. No hace falta atacante: ocurre en el flujo normal.
- **Vector:** uso legítimo de la app. No requiere manipulación.
- **Mitigación:** (1) alinear el contrato: aceptar en `/onboarding/complete` (o en los PUT) el formato real del frontend y mapear `restrictions` a `food_restrictions` (`restriction_type: 'allergy'`), `conditions[]` a `HealthCondition` e `injuries[]` a `injuries_or_limitations`/claves del selector; (2) test e2e que compruebe que una alergia declarada aparece en el `userContextPrompt` (SDK simulado); (3) el plan de respaldo debe filtrar ingredientes por las restricciones guardadas o no proponer comidas concretas; (4) si el usuario declaró restricciones y no se pudieron guardar, bloquear la generación.
- **Agente:** backend (con contrato acordado con frontend; ver JB-03).
- **¿Bloquea deploy?** **Sí.**

#### JB-02 — Verificación de edad mínima (16) eludible: menores reciben planes calóricos de IA 🔴
- **Técnica:** AML.T0048 External Harms. Relacionado: LLM09 y LOPDGDD art. 7.
- **Archivos:** `backend/src/routes/onboarding.routes.js:16-17` (exige `name` y `birthdate`, que el frontend no envía); `frontend/src/screens/onboarding/OnboardingProfile.tsx:30` (acepta edad 10-100), `:41-57` (envía `age`, ignora el 400); `backend/src/controllers/onboarding.controller.js:41-51` (comprobación de edad solo en `saveProfile`), `:178-188` (`complete` crea el perfil con `birthYear = año - p.age` **sin validar edad ni rangos**); `aiService.js:48` (limita la edad a un mínimo de 10).
- **Descripción:** en el flujo real, `PUT /onboarding/profile` siempre falla en la validación y el perfil se crea en `/complete` a partir de `req.body.profile.age`, sin comprobar la edad mínima. Un menor de 10-15 años obtiene un plan de pérdida de peso con déficit del 20 % y mínimo de 1200 kcal. Ni el prompt ni la salida tienen salvaguardas para menores.
- **Impacto:** daño a menores (déficit calórico en crecimiento, riesgo de TCA), tratamiento de datos de salud de menores sin base legal y sanción regulatoria.
- **Vector:** introducir una edad < 16 en la app (sin manipular nada) o enviar `profile.age` directamente al endpoint.
- **Mitigación:** validar en `/onboarding/complete` (servidor) edad ≥ 16 y rangos fisiológicos con rechazo 400 (cubre también SEC-20); el frontend debe exigir ≥ 16; añadir una regla al system prompt y una comprobación en la salida para que, si la edad es < 18, no se den objetivos de pérdida de peso (ver `PROMPT_REVIEW.md`).
- **Agente:** backend.
- **¿Bloquea deploy?** **Sí.**

#### JB-05 — Sin salvaguardas clínicas en el prompt ni en la salida (mínimo calórico, IMC bajo, TCA, condiciones) 🟠
- **Técnica:** AML.T0048 External Harms. Relacionado: LLM09.
- **Archivos:** `aiService.js:59-69` (mínimo de 1200 kcal solo para `lose_weight`, igual para ambos sexos y solo en el cálculo); `:138-145` (criterios sin reglas clínicas); `:512-519` (no se valida `daily_calories` ni las calorías por comida); `onboarding.controller.js:349-361` (las comidas guardadas usan `approximate_calories` del modelo).
- **Descripción:** el valor que se guarda y se muestra en `targets.calories` sale de `metabolism`, pero las comidas creadas usan las calorías del modelo sin comprobar. No hay regla para IMC < 18,5 con objetivo de perder peso, ni para embarazo, ni para TCA, ni un aviso médico persistente para condiciones (diabetes, cardiopatía). El modelo puede devolver un `daily_calories` o un reparto por comidas por debajo de mínimos, por alucinación o por inyección, y no se detecta.
- **Impacto:** recomendaciones dietéticas peligrosas a personas vulnerables.
- **Vector:** perfil legítimo con IMC bajo y objetivo de perder peso, o campo libre que empuje al modelo hacia déficits extremos (sin payload).
- **Mitigación:** reglas en el system prompt (texto propuesto en `PROMPT_REVIEW.md` §3), validador posterior (suma de calorías de las comidas dentro de ±15 % del objetivo calculado; mínimo por sexo de 1500/1200 kcal; si IMC < 18,5 o edad < 18, impedir el objetivo de perder peso); aviso médico visible en la app para usuarios con condiciones.
- **Agente:** ai.
- **¿Bloquea deploy?** No (recomendado antes del lanzamiento público).

### AML.TA0005 Execution / AML.T0051 LLM Prompt Injection

#### JB-06 — El sanitizador de entrada se puede eludir: escape de `<user_data>`, NFC en vez de NFKC, anchos cero y lista negra solo en inglés 🟠
- **Técnicas:** AML.T0051.000 (Direct), AML.T0068 LLM Prompt Obfuscation, AML.T0015 Evade AI Model.
- **Archivos:** `aiService.js:168-175` (6 patrones en inglés; el regex de etiquetas no incluye `user_data`), `:186` (NFC), `:188` (no elimina U+200B-U+200D, U+2060, U+00AD), `:244`/`:308` (delimitadores sin escapar), `:236-241` (presupuesto común en orden de aparición).
- **Descripción:** los campos libres que llegan al prompt (`profession`, `injuries_or_limitations`, `food_name`, `condition_name`) pueden: cerrar el bloque `<user_data>` con la etiqueta literal, falsificar `---SECCIÓN---` o "## INSTRUCCIÓN FINAL" en línea, y evitar los regex con ancho completo, anchos cero o idioma español. Además, como el presupuesto de 2000 caracteres se consume en orden, `profession` (100) e `injuries` (300) pueden agotar el espacio de restricciones y condiciones. El impacto está acotado: no hay tools, ni RAG, ni datos de otros usuarios en el contexto, y la salida pasa por `JSON.parse`. Lo explotable es manipular el **propio** plan (contenido dañino que se guarda en BD, calorías), extraer el system prompt (bajo valor, no tiene secretos) y gastar tokens.
- **Impacto:** la integridad del plan del propio usuario. Si en el futuro se comparten planes, se añaden tools o se usa la salida para otros usuarios, el impacto crece.
- **Vector:** texto en `profession`/`injuries_or_limitations` con delimitadores falsos u ofuscación Unicode (categoría, sin payload).
- **Mitigación:** (1) NFKC más eliminación de la categoría Unicode `Cf` (formato) y `Cc`; (2) escapar `<`, `>` y secuencias `---` en los datos de usuario, o serializarlos como **JSON** dentro del bloque (`JSON.stringify` del objeto con lista blanca de campos); (3) usar delimitadores con un nonce aleatorio por petición (`<user_data id="...">`) y mencionarlo en el system prompt; (4) presupuesto reservado por prioridad (alergias y lesiones primero); (5) **no** basar la defensa en la lista negra: mantenerla solo como telemetría; (6) la defensa principal es la validación de salida (JB-04).
- **Agente:** ai.
- **¿Bloquea deploy?** No.

### AML.TA0011 Impact / LLM05 Improper Output Handling

#### JB-04 — La salida del LLM se guarda y controla bucles sin validación de esquema ni rangos 🟠
- **Técnicas:** AML.T0048 / AML.T0029 Denial of AI Service (amplificación local), AML.T0024 (campos libres). OWASP LLM05.
- **Archivos:** `aiService.js:510-519` (`...parsed`); `onboarding.controller.js:291` (`training_plan.weeks` sin comprobar), `:308-320` (bucle `weeks × weekly_schedule`), `:345-365` (`meal_suggestions × 7`, `meal_type` y `calories` del modelo); `plans.controller.js:119`, `:129-141`, `:153-159` (`createdSessions × 4`).
- **Descripción:** el JSON devuelto se usa directamente para: número de semanas (bucle), número de días (`weekly_schedule` puede tener N elementos), `day_of_week` (desplazamiento de fechas arbitrario), `meal_type` (enum de Prisma: un valor inválido provoca 500 con el plan ya creado, sin transacción), calorías y macros (guardados) y `notes` (sin límite). Si el modelo devuelve `weeks` de un valor enorme, por alucinación o por inyección de JB-06, se generan millones de filas o el proceso se queda sin memoria. Las escrituras no van en transacción: un fallo deja planes a medias y el plan anterior ya pausado o completado.
- **Impacto:** DoS del backend y de la BD, datos corruptos y valores nutricionales sin control en la app.
- **Vector:** inyección indirecta en el propio perfil que haga devolver estructuras desproporcionadas, o simple alucinación.
- **Mitigación:** esquema estricto (zod ya está instalado) con `additionalProperties: false`, `weeks ∈ [1,12]`, `weekly_schedule.length === 7`, `day_of_week ∈ [1,7]` sin repetir, `meal_type ∈ enum`, calorías y macros en rangos, longitudes máximas de strings; si falla, usar el plan de respaldo. Alternativa preferible: **structured outputs** de la API (`output_config.format` con JSON Schema), que requiere actualizar el SDK (JB-16). Envolver la creación del plan en `prisma.$transaction`.
- **Agente:** ai.
- **¿Bloquea deploy?** No (muy recomendado antes del registro público).

### AML.TA0042 Cost Harvesting / AML.T0034

#### JB-07 — Rate limiters de IA ineficaces: sin `trust proxy`, `apiLimiter` antes de autenticar y MemoryStore 🟠
- **Técnicas:** AML.T0034 Cost Harvesting, AML.T0029 Denial of AI Service.
- **Archivos:** `backend/src/app.js:120-128` (`apiLimiter` montado **antes** de los routers que llaman a `authenticate`, así que `req.user` no existe y la clave es `req.ip`); `rateLimiter.middleware.js:30`, `:49`; ausencia de `app.set('trust proxy', …)` en `app.js` y `server.js`; todos los limitadores usan el MemoryStore por defecto.
- **Descripción:** en Railway, `req.ip` es la IP del proxy de entrada. Por eso `apiLimiter` (100 req/15 min) y `registrationLimiter` (3/h) son **cupos globales** para todos los usuarios: un solo cliente puede bloquear la API de todos. Los límites de IA por userId (`planGenerationLimiter`, `planRegenerateLimiter`) sí usan userId, pero viven en memoria: cada deploy o reinicio los pone a cero y no se comparten entre réplicas.
- **Impacto:** DoS de la app y límites de coste IA que se reinician con cada deploy.
- **Vector:** ráfagas de peticiones autenticadas o anónimas desde un solo origen; registros repetidos.
- **Mitigación:** `app.set('trust proxy', 1)` (o el número de saltos de Railway); mover `apiLimiter` después de `authenticate` o usar un `keyGenerator` que decodifique el JWT; store en Redis (`rate-limit-redis`) para los limitadores de IA; cuota diaria de tokens por usuario en Redis (JB-12).
- **Agente:** backend. **Coincide con security** (rate limiting clásico).
- **¿Bloquea deploy?** No (recomendado).

### AML.TA0008 Discovery / AML.T0069 + Cost Harvesting

#### JB-08 — `/health/ai`: bloqueo frágil, falla en abierto y llama a Anthropic en cada GET 🟠
- **Técnicas:** AML.T0069 Discover LLM System Information, AML.T0034 Cost Harvesting, AML.T0040 AI Model Inference API Access.
- **Archivos:** `backend/src/app.js:62-83` (`:63` bloqueo por `NODE_ENV`, `:65-68` token opcional y comparación `!==`, `:73-78` llamada real, `:81` devuelve `err.message`/`status`).
- **Descripción:** el bloqueo fuera de producción depende de `NODE_ENV === 'production'` exacto: cualquier otro valor o un error tipográfico ('prod', 'Production', o no definido) lo deja abierto. Si `ADMIN_TOKEN` no existe en ese entorno, cualquiera puede invocarlo. No pasa por ningún limitador: cada GET es una petición de pago a Anthropic y consume el cupo de peticiones de la organización. Si staging comparte API key u organización con producción, un atacante puede **agotar el cupo de producción desde staging**. Devuelve el mensaje de error del proveedor (información sobre estado de la cuenta, cuota o modelo). Es un endpoint de depuración "temporal" desde `df455ac` (2026-09-06).
- **Impacto:** abuso económico, DoS por cupo y reconocimiento.
- **Vector:** GET repetidos al endpoint en staging (no probado, por restricción de la auditoría).
- **Mitigación:** **eliminar el endpoint** o, como mínimo: activarlo solo si `ENABLE_AI_DIAGNOSTICS === 'true'` (permitir, no denegar), `ADMIN_TOKEN` obligatorio (si falta, 404), `crypto.timingSafeEqual`, rate limit de 1/min, respuesta `{ ok: boolean }` sin `err.message`, y API key distinta por entorno.
- **Agente:** backend. **Coincide con security** (endpoints de depuración).
- **¿Bloquea deploy?** No (en producción devuelve 404 si `NODE_ENV` está bien). **Prueba propuesta P-05** para confirmarlo.

### AML.TA0009 Exfiltration (hacia terceros) / privacidad del flujo IA

#### JB-09 — Datos de salud enviados a Anthropic sin control de consentimiento y transferencia internacional sin formalizar 🟠
- **Técnica:** AML.T0057 LLM Data Leakage (exposición de datos a un tercero). OWASP LLM02. RGPD art. 9 y art. 44-46.
- **Archivos:** `onboarding.controller.js:158-284` (`complete` no comprueba `user.health_consent_given_at` antes de llamar a la IA); `:112-139` (`saveHealth` registra el consentimiento **sin mirar `healthConsent`** y en el flujo real nunca llega a ejecutarse, por JB-01); `plans.controller.js:56-100` (tampoco lo comprueba); `docs/rgpd-compliance.md:203`, `:215`, `:219` (SCC/DPA con Anthropic "pendiente").
- **Descripción:** se envían a Anthropic (EE. UU.) edad, sexo, peso, altura, tabaquismo, sueño, estrés, profesión y, cuando JB-01 se corrija, condiciones médicas y alergias. Todo ello sin un consentimiento art. 9 registrado y verificado por el servidor, y con la base de transferencia internacional sin documentar. `profession` no es necesaria para el plan (minimización). Positivo: no se envían nombre ni email, solo `userId` en logs y no en el prompt.
- **Impacto:** incumplimiento RGPD en datos de categoría especial.
- **Vector:** flujo normal.
- **Mitigación:** comprobar en servidor que `health_consent_given_at` existe antes de `generatePlan`/`regeneratePlan` (si no, usar plan de reglas o pedir el consentimiento); registrar el consentimiento solo si `healthConsent === true`; formalizar DPA/SCC con Anthropic y revisar las opciones de retención de datos de la API; eliminar `profession` del prompt o reducirla a una categoría (`work_type`).
- **Agente:** backend. **Coincide con security** (RGPD).
- **¿Bloquea deploy?** No técnicamente. Antonio y el área legal deben valorarlo antes del lanzamiento con datos reales.

### AML.TA0004 Execution / fiabilidad del contexto

#### JB-03 — El frontend ignora los errores de guardado del onboarding y continúa 🟠
- **Técnica:** AML.T0048 (condición necesaria de JB-01 y JB-02).
- **Archivos:** `frontend/src/screens/onboarding/OnboardingProfile.tsx:51-55`, `OnboardingLifestyle.tsx` (bloque `catch` tras `api.put`), `OnboardingTraining.tsx:41-44`, `OnboardingNutrition.tsx:43-45`, `OnboardingHealth.tsx:57-60`, `OnboardingMotivation.tsx:117-119`.
- **Descripción:** todos los pasos hacen `catch { …; navigation.navigate(next) }`. Un 400 de validación (edad, alergias) no se muestra y el usuario cree que sus datos de salud se tuvieron en cuenta. Además, el consentimiento de salud se envía como `true` fijo (`OnboardingHealth.tsx:53`).
- **Impacto:** el usuario confía en un plan que no considera sus restricciones.
- **Mitigación:** mostrar el error de validación y no avanzar; reintentar solo ante errores de red; no enviar `healthConsent: true` fijo, sino el valor del checkbox.
- **Agente:** frontend.
- **¿Bloquea deploy?** No por sí solo (se resuelve junto con JB-01).

#### JB-10 — Catálogo de ejercicios inutilizado: se pasa como `extraContext`, se aplana y se trunca a 500 caracteres 🟡
- **Técnicas:** AML.T0062 Discover LLM Hallucinations, AML.T0051.002 (superficie).
- **Archivos:** `onboarding.controller.js:278-284` (4º argumento), `aiService.js:452` (firma: el 4º es `extraContext`, el 5º `exercises`), `:311-314` (`sanitizeTextField(extraContext, 500)` elimina `\n` y trunca), `:569`; `:97-105` (el esquema JSON no tiene `id`, aunque `:152` exige un ID).
- **Descripción:** el modelo recibe un catálogo truncado en una línea y además, en regeneración, en una sección "CONTEXTO DE ACTUALIZACIÓN" junto a texto del servidor. Inventa ejercicios que no se filtran por lesiones. Las sesiones guardadas usan el catálogo por rotación y no lo que propone el modelo, por lo que el plan devuelto (`generated_plan`) y lo guardado no coinciden.
- **Mitigación:** pasar `catalogExercises` como 5º argumento (`exercises`) para que se use el `formatExercisesForPrompt` saneado de `aiService`; añadir `"id"` al esquema; validar IDs en ambos flujos (cierra SEC-03/SEC-23); poner el catálogo en su propio bloque delimitado (`<exercise_catalog>`) marcado como datos.
- **Agente:** ai.
- **¿Bloquea deploy?** No.

### AML.TA0042 Cost Harvesting / disponibilidad

#### JB-11 — Cliente Anthropic sin timeout ni `maxRetries` propios y sin tratar `stop_reason` 🟡
- **Técnica:** AML.T0029 Denial of AI Service, AML.T0034.
- **Archivos:** `aiService.js:497` (`new Anthropic({ apiKey })` en cada petición, valores por defecto del SDK 0.52: timeout de 10 min y 2 reintentos; verificado en `node_modules/@anthropic-ai/sdk/client.js:57,67`), `:500-508` (no comprueba `stop_reason`), `:502` (`max_tokens: 4096`); `frontend/src/stores/planStore.ts:365` (el cliente corta a 90 s).
- **Descripción:** una petición lenta puede retener la conexión hasta 30 min (10 min × 3) aunque el cliente ya haya desistido a los 90 s, y se sigue pagando. Con `max_tokens: 4096`, un plan de 7 días con comidas puede cortarse (`stop_reason: "max_tokens"`): el JSON queda inválido, se usa el plan de respaldo sin avisar y se pierde el coste. Tampoco se trata `stop_reason: "refusal"`.
- **Mitigación:** cliente singleton con `timeout` de ~60 s y `maxRetries: 1`; comprobar `stop_reason` (`end_turn` obligatorio); dimensionar `max_tokens` según el esquema real (medir con `count_tokens` en local, sin datos reales); `AbortController` ligado al cierre de la petición HTTP.
- **Agente:** ai.
- **¿Bloquea deploy?** No.

#### JB-12 — Sin medición de tokens ni coste por usuario y sin prompt caching (AI-05 declarado pero no implementado) 🟡
- **Técnica:** AML.T0034 Cost Harvesting (falta de detección).
- **Archivos:** `aiService.js:500-505` (no se lee `response.usage`, no hay `cache_control`), `:444` (el comentario dice "Implementa prompt caching" y no es cierto); modelo `TokenUsageLog` en `backend/prisma/schema.prisma:628` sin escrituras; `docs/architecture-web.md:102` y `docs/ai-architecture.md:33` afirman que hay caching.
- **Descripción:** no hay datos para detectar abuso ni para la alerta de 50k tokens/día de SEC-06. La documentación de costes ($0.13/usuario/mes) parte de un caching que no existe.
- **Mitigación:** registrar `usage` (input, output, cache) en `TokenUsageLog` y en un contador diario en Redis por userId con corte duro; alerta cuando se supere el umbral; aplicar `cache_control` al bloque de sistema (comprobar el tamaño mínimo de prefijo cacheable del modelo; el prompt actual podría quedarse corto, así que hay que medirlo) y verificarlo con `usage.cache_read_input_tokens`.
- **Agente:** ai.
- **¿Bloquea deploy?** No.

### AML.TA0006 Persistence / caché

#### JB-13 — El plan de respaldo se cachea 24 h y la caché no se invalida al cambiar el perfil 🟡
- **Técnica:** AML.T0029 (disponibilidad degradada), integridad del plan.
- **Archivos:** `aiService.js:532` (`storeInCache(cacheKey, fallback)`), `:457-488` (cualquier generación del mismo día devuelve la caché sin mirar si cambiaron los datos de entrada), `:21` (TTL 86400); `cacheService.js:203-220` (`invalidateUserCache` existe pero el módulo no se usa y su `require('../utils/logger')` (`:10`) apunta a un archivo inexistente).
- **Descripción:** un fallo transitorio de Anthropic deja al usuario 24 h con el plan de reglas (que incluye alérgenos, JB-01). Si el usuario corrige una alergia y vuelve a completar el onboarding el mismo día (tras un reinicio del limitador), recibe el plan anterior. La clave **sí está aislada por usuario** (`plan:{userId}:{fecha}`, userId del JWT): no se observa envenenamiento ni fuga entre usuarios.
- **Mitigación:** no cachear el plan de respaldo, o cachearlo con TTL corto (5-10 min); incluir en la clave un hash de los datos de entrada (`plan:{userId}:{sha256(onboardingData)}`); invalidar al guardar onboarding; eliminar o reparar `cacheService.js`.
- **Agente:** ai.
- **¿Bloquea deploy?** No.

#### JB-14 — Cifrado y HMAC de caché que fallan en abierto, sin comprobación al arrancar y con comparación no constante 🟡
- **Técnicas:** AML.T0035 AI Artifact Collection, AML.T0070 (integridad de artefactos).
- **Archivos:** `crypto.util.js:44`, `:57`; `aiService.js:426-430`, `:461-476`.
- **Descripción:** detalla los ⚠️ de SEC-10 y SEC-16. Sin las variables de entorno, todo queda en claro sin aviso. Una clave no hexadecimal produce un `Buffer` corto: `createCipheriv` lanza una excepción y el plan no se cachea, también sin aviso.
- **Mitigación:** validar al arrancar (en producción y staging) que `REDIS_ENCRYPTION_KEY` tiene 64 caracteres hexadecimales y, si no, abortar; con AES-GCM, quitar el HMAC redundante o usar `timingSafeEqual`; rechazar entradas sin el formato esperado; TLS en `REDIS_URL` (`rediss://`).
- **Agente:** backend. **Coincide con security** (secretos y cifrado).
- **¿Bloquea deploy?** No.

### AML.TA0003 Resource Development / catálogo

#### JB-15 — La exclusión de ejercicios por lesión no funciona: claves que no coinciden y datos que nunca llegan 🟡
- **Técnica:** AML.T0048 (seguridad del plan).
- **Archivos:** `exerciseSelector.service.js:49-56` (claves `knee`, `lower_back`, `shoulder`, `wrist`, `ankle`, `neck`), `:129-136` (solo filtra por `target`); `OnboardingHealth.tsx:23-30` (identificadores `back`, `knee`, …); `onboarding.controller.js:273-275` (divide `injuries_or_limitations` por comas, que siempre está vacío por JB-01).
- **Descripción:** aunque se arregle JB-01, `back` no coincide con `lower_back` y el filtro por `target` no excluye ejercicios cuyo riesgo está en `bodyPart` o en los músculos secundarios.
- **Mitigación:** tabla de equivalencias única compartida (ids del frontend → zonas), filtrar también por `bodyPart` y `secondaryMuscles`, y tests.
- **Agente:** backend.
- **¿Bloquea deploy?** No.

### AML.TA0044 Supply Chain / AML.T0010

#### JB-16 — `@anthropic-ai/sdk` 0.52.0 muy desactualizado; la PR de dependabot a 0.133 tiene el CI en rojo 🟡
- **Técnica:** AML.T0010 AI Supply Chain Compromise (riesgo de mantenimiento más que de compromiso).
- **Archivos:** `backend/package.json:23`, `backend/package-lock.json:11`; `node_modules/@anthropic-ai/sdk/package.json` (0.52.0, **sin dependencias de ejecución**).
- **Valoración:** quedarse en 0.52 tiene un riesgo directo bajo: no tiene dependencias transitivas, la versión está fijada, `npm audit` está en CI y no conozco avisos públicos que afecten a esta versión (habría que contrastarlo con `npm audit` al revisar la PR). El coste es funcional y de seguridad indirecta: 81 versiones menores de atraso impiden usar con tipos los *structured outputs* (`output_config.format`, la mejor mitigación de JB-04) y los campos recientes de `stop_reason`/`stop_details`. **No mergear la PR de dependabot con el CI en rojo**: un salto de 0.x a 0.x puede romper la API. Además, `aiService.js` está excluido de la cobertura (`backend/jest.config.js:44`), así que un CI verde tampoco garantiza que la generación funcione.
- **Mitigación:** rama dedicada para actualizar el SDK: tests unitarios de `generatePlan` con el SDK simulado (respuesta válida, `max_tokens`, `refusal`, error 429/5xx), revisar el CHANGELOG del SDK entre 0.52 y 0.133, después adoptar `output_config.format`. Regenerar el lock para que coincida con `package.json`. Mantener la versión exacta y `npm ci`.
- **Agente:** backend (con devops para el CI).
- **¿Bloquea deploy?** No.

### AML.TA0006 Persistence / configuración

#### JB-17 — `AI_SYSTEM_PROMPT` sustituye por completo el system prompt, incluidas las reglas de seguridad, sin validación ni versionado 🟢
- **Técnica:** AML.T0081 Modify AI Agent Configuration (persistencia por configuración).
- **Archivos:** `aiService.js:162`; `backend/.env.example` (variable `AI_SYSTEM_PROMPT`); `ANTHROPIC_MODEL` declarado en `.env.example` pero no usado (`aiService.js:20` fijo).
- **Descripción:** quien tenga acceso a las variables de Railway puede quitar las reglas de seguridad sin que quede rastro en git. La "confidencialidad" que aporta es mínima.
- **Mitigación:** mantener el prompt en el código (versionado y revisado en PR); si se mantiene la opción de sobrescribirlo, añadir siempre al final un bloque de seguridad fijo no sobrescribible y registrar el hash del prompt efectivo al arrancar. Usar `ANTHROPIC_MODEL` con lista blanca o quitarlo del `.env.example`.
- **Agente:** ai.
- **¿Bloquea deploy?** No.

### Higiene / reconocimiento

#### JB-18 — Código IA muerto con prompts sin sanitizar y módulos con `require` roto 🟢
- **Técnica:** AML.T0051 (riesgo de reintroducción), AML.T0000 (reconocimiento si el repo se publica).
- **Archivos:** `ai/planGenerator.ts` (interpola sin sanitizar `profession`, `injuries_or_limitations`, `notes`, `previous_attempts_notes`), `src/prompts/planPromptBuilder.js:119-157`, `src/services/planGeneratorService.js`, `src/index.js` (paquete `healthy-ai` con `@prisma/client` 5); `backend/src/services/cacheService.js:10` y `backend/src/services/authService.js:10` (`require('../utils/logger')`, archivo inexistente: solo existe `logger.util.js`).
- **Descripción:** si alguien conecta por error estos módulos (la documentación `ai/README.md` y `docs/ai-architecture.md:336` los presenta como la implementación), vuelve la inyección de SEC-01 sin defensas.
- **Mitigación:** eliminar o archivar `ai/` y `src/` del proyecto raíz (o marcarlos claramente como obsoletos) y corregir la documentación para que apunte a `backend/src/services/aiService.js`; eliminar o reparar `cacheService.js`/`authService.js`.
- **Agente:** orquestador (decisión de borrado; requiere el OK de Antonio).
- **¿Bloquea deploy?** No.

#### JB-19 — Logs de errores con posible contenido de salud procedente de la salida del LLM 🟢
- **Técnica:** AML.T0057 (fuga a logs).
- **Archivos:** `backend/src/middleware/errorHandler.middleware.js:10` (registra `err.message` + `stack`); los errores de Prisma al guardar la salida del LLM (`meal_type` inválido, etc.) incluyen fragmentos de los argumentos; `aiService.js:528` (registra `err.message` del SDK, que en errores 400 puede citar contenido de la petición).
- **Descripción:** no se registran prompts ni datos de onboarding (✅, contrario a lo que pedía SEC-13 original, y es mejor así), pero los mensajes de error pueden incluir valores. Solo se registra `userId` (seudónimo).
- **Mitigación:** en producción, registrar `err.code`/`name` y un id de correlación, sin `message` completo de Prisma ni del SDK; política de retención de logs en Railway.
- **Agente:** backend. **Coincide con security** (logs).
- **¿Bloquea deploy?** No.

#### JB-20 — `.gitignore` de SEC-14 inconsistente: no saca del índice lo versionado e ignora entregables de seguridad 🟢
- **Técnica:** AML.T0000 Search Open Technical Databases.
- **Archivos:** `.gitignore` (raíz; patrones `CLAUDE.*.md`, `PR-*.md`, `*_STATUS.md`, `*_AUDIT.md`, `auditoria_*.md`), `projects/healthy/.gitignore` (`app.json`).
- **Descripción:** los documentos internos siguen versionados; los nuevos `*_AUDIT.md` (incluido este `ATLAS_AUDIT.md`) quedan ignorados y se perderían sin `git add -f`; `app.json` está ignorado pero versionado.
- **Mitigación:** decidir la política: o se versionan los entregables de seguridad (quitar `*_AUDIT.md` del ignore) o se sacan del índice con `git rm --cached` antes de hacer público el repo. Mantener `app.json` versionado.
- **Agente:** orquestador.
- **¿Bloquea deploy?** No.

---

## Técnicas ATLAS evaluadas sin hallazgo nuevo

| Técnica | Resultado |
|---|---|
| AML.T0053 / AML.T0086 Exfiltración vía invocación de tools del agente | ⚪ N/A: `messages.create` sin `tools` (`aiService.js:500-505`, `app.js:73-78`). No hay agencia: el modelo no ejecuta acciones; el backend decide qué se guarda (pero ver JB-04: la salida *controla* escrituras) |
| AML.T0070 RAG Poisoning / AML.T0080 Memory poisoning | ⚪ N/A: sin RAG ni historial. Los planes cacheados se aíslan por usuario |
| AML.T0057 Fuga entre usuarios | 🟢 No observada: un usuario por petición, clave de caché con el userId del JWT, consultas Prisma filtradas por `user_id` |
| AML.T0051.002 vía alimentos (N-1, OFF/USDA) | ⚪ N/A hoy: los alimentos no entran en el prompt. **Si en el futuro se incluyen nombres de alimentos de Open Food Facts (contenido de terceros) en prompts, tratarlos como datos no fiables** |
| AML.T0020 / T0018 / T0044 (envenenar o acceder al modelo) | ⚪ N/A: consumidor de la API, sin fine-tuning |
| AML.T0024.000/001 Inferencia de pertenencia / inversión de modelo | ⚪ N/A |

## Pruebas dinámicas propuestas (requieren autorización de Antonio)

Detalle en `PROMPT_REVIEW.md` §6. Resumen:

| ID | Objetivo | Técnica | Entorno | Resultado esperado |
|---|---|---|---|---|
| P-01 | Comprobar que una alergia declarada en la app llega al prompt | AML.T0048 | Local, SDK simulado | La sección "RESTRICCIONES" aparece (hoy falla: JB-01) |
| P-02 | Menor de 16 años completa el onboarding | AML.T0048 | Local o staging con cuenta de prueba | 400 `AGE_RESTRICTION` (hoy 201: JB-02) |
| P-03 | Escape de delimitador y ofuscación Unicode contra `sanitizeTextField` | AML.T0051 / T0068 | Unitario local, sin modelo | Las etiquetas y separadores falsos quedan escapados |
| P-04 | Respuesta del modelo simulada con `weeks` enorme, `meal_type` inválido o `daily_calories` bajo | LLM05 | Unitario local | Se rechaza y se usa el plan de respaldo, sin escrituras masivas |
| P-05 | Comprobar que `/health/ai` devuelve 404 en producción y 401 en staging sin token | AML.T0069 | Un GET a cada entorno, sin cabeceras (lo autoriza Antonio) | 404 / 401. Si staging responde 200, es crítico por coste |
| P-06 | Batería de red-team de inyección y jailbreak contra el modelo real | AML.T0051 / T0054 | Staging con API key de pruebas y presupuesto limitado | El JSON sigue siendo válido, sin revelar el prompt, y la validación de salida rechaza lo anómalo |

---

## Tabla de tareas para el orquestador (JB-nn)

> IDs provisionales: el orquestador los renumerará como SEC-25+ al consolidar.

| ID | Sev. | Título | Agente | Archivo principal | Bloquea deploy |
|---|---|---|---|---|---|
| JB-01 | 🔴 | Alergias, lesiones y condiciones del onboarding no llegan al prompt; el plan de respaldo tiene alérgenos fijos | backend | `backend/src/controllers/onboarding.controller.js:99,178-207` + `routes/onboarding.routes.js:45,69` | **Sí** |
| JB-02 | 🔴 | Comprobación de edad ≥16 y rangos fisiológicos eludibles en `/onboarding/complete` | backend | `backend/src/controllers/onboarding.controller.js:178-188` | **Sí** |
| JB-03 | 🟠 | El frontend ignora los errores del onboarding y envía `healthConsent: true` fijo | frontend | `frontend/src/screens/onboarding/*.tsx` (catch tras `api.put`) | No |
| JB-04 | 🟠 | Validación de esquema y rangos de la salida del LLM antes de guardar y de usarla en bucles; transacción | ai | `backend/src/services/aiService.js:510-519` | No (muy recomendado) |
| JB-05 | 🟠 | Salvaguardas clínicas en el prompt y en la salida (mínimos calóricos, IMC, menores, TCA) | ai | `backend/src/services/aiService.js:59-69,138-159` | No (recomendado) |
| JB-06 | 🟠 | Endurecer `sanitizeTextField`: NFKC, Cf/Cc, escape de delimitadores, nonce, presupuesto por prioridad | ai | `backend/src/services/aiService.js:168-192,236-241` | No |
| JB-07 | 🟠 | Rate limiting: `trust proxy`, `apiLimiter` después de autenticar, store en Redis | backend | `backend/src/app.js:120-128`, `middleware/rateLimiter.middleware.js` | No (recomendado) |
| JB-08 | 🟠 | Eliminar `/health/ai` o activarlo solo por opción explícita, con token obligatorio y rate limit | backend | `backend/src/app.js:62-83` | No |
| JB-09 | 🟠 | Comprobar el consentimiento art. 9 antes de llamar a la IA; DPA/SCC con Anthropic; minimizar `profession` | backend | `backend/src/controllers/onboarding.controller.js:112-139,284` | No (decisión legal) |
| JB-10 | 🟡 | Pasar el catálogo como `exercises` (5º argumento), `id` en el esquema y validar IDs en ambos flujos | ai | `backend/src/services/aiService.js:311-314,569` + `onboarding.controller.js:284` | No |
| JB-11 | 🟡 | Cliente Anthropic singleton con timeout y reintentos acotados; tratar `stop_reason` | ai | `backend/src/services/aiService.js:497-508` | No |
| JB-12 | 🟡 | Medir `usage` (TokenUsageLog y cuota diaria en Redis), alertas y prompt caching real | ai | `backend/src/services/aiService.js:500-505` | No |
| JB-13 | 🟡 | No cachear 24 h el plan de respaldo; clave con hash de entrada; invalidar al editar el perfil | ai | `backend/src/services/aiService.js:454,532` | No |
| JB-14 | 🟡 | Exigir claves de cifrado de caché al arrancar; quitar o reforzar el HMAC (`timingSafeEqual`) | backend | `backend/src/utils/crypto.util.js:44,57` | No |
| JB-15 | 🟡 | Equivalencias de lesiones frontend↔selector; filtrar por `bodyPart` y músculos secundarios | backend | `backend/src/services/exerciseSelector.service.js:49-56,129-136` | No |
| JB-16 | 🟡 | Actualizar `@anthropic-ai/sdk` de forma controlada (tests con SDK simulado); no mergear la PR con el CI en rojo | backend | `backend/package.json:23` | No |
| JB-17 | 🟢 | `AI_SYSTEM_PROMPT`: bloque de seguridad no sobrescribible y hash registrado; `ANTHROPIC_MODEL` sin uso | ai | `backend/src/services/aiService.js:20,162` | No |
| JB-18 | 🟢 | Retirar el código IA muerto (`ai/`, `src/`) y reparar los `require('../utils/logger')` | orquestador | `ai/planGenerator.ts`, `src/prompts/planPromptBuilder.js`, `backend/src/services/cacheService.js:10` | No |
| JB-19 | 🟢 | Logs de error sin `message` completo de Prisma ni del SDK en producción | backend | `backend/src/middleware/errorHandler.middleware.js:10` | No |
| JB-20 | 🟢 | Política de `.gitignore` para documentos internos y entregables de seguridad | orquestador | `.gitignore` (raíz) | No |

### Coincidencias con el ámbito del agente security (para deduplicar)

- **Rate limiting y `trust proxy`:** JB-07 (y SEC-05/SEC-06).
- **Endpoint de depuración `/health/ai`:** JB-08 (y SEC-19).
- **RGPD: consentimiento art. 9 y transferencia internacional:** JB-09.
- **Secretos y cifrado de caché, comprobación de variables al arrancar:** JB-14 (y SEC-10/16/24).
- **Logs con datos:** JB-19.
- **Dependencias y PR de dependabot:** JB-16 (y SEC-13).
- **Validación de entrada en las rutas (longitudes, rangos, mass assignment `...c`/`...r`/`...a` en `onboarding.controller.js:119,123,215`):** relacionado con JB-01/JB-02. La asignación masiva es del ámbito clásico.
- **Documentación interna en el repo:** JB-20 (SEC-14).

*Generado por el agente JailBreak — 2026-10-19 — uso interno del equipo Healthy.*
