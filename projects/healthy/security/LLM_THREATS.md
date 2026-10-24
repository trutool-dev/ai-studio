# Amenazas LLM — OWASP Top 10 for LLM Applications (2025) — Proyecto Healthy

> **Nota del orquestador (2026-10-19):** los IDs provisionales SA-xx / JB-xx de este informe se han consolidado como **SEC-25..SEC-72** en `SECURITY_TASKS.md` (columna "Origen"). Resumen ejecutivo: `AUDIT_SUMMARY_2026-10-19.md`.

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19 |
| Auditor | Agente JailBreak (Claude Opus 5.5) |
| Commit | `4993123` (`develop`) |
| Método | Estático; sin llamadas a Anthropic ni a staging/producción |
| Referencias | Hallazgos `JB-nn` en `ATLAS_AUDIT.md`; prompts en `PROMPT_REVIEW.md` |

## 1. Perfil del componente IA

| Aspecto | Valor verificado en el código |
|---|---|
| Caso de uso | Generar un plan de 4 semanas de entrenamiento y nutrición en JSON a partir del perfil de onboarding |
| Puntos de entrada | `POST /onboarding/complete` (`onboarding.controller.js:284`), `POST /plans/regenerate` (`plans.controller.js:100`), `GET /health/ai` (`app.js:62`, diagnóstico) |
| Modelo | `claude-sonnet-4-6` fijo en el código (`aiService.js:20`). En `/health/ai`, `claude-haiku-4-5-20251001` (`app.js:74`). `ANTHROPIC_MODEL` del `.env.example` no se usa |
| Parámetros | `max_tokens: 4096`, sin `temperature`, sin `tools`, sin streaming, sin `cache_control`, sin structured outputs (`aiService.js:500-505`) |
| SDK | `@anthropic-ai/sdk` 0.52.0 fijado (sin dependencias de ejecución). Timeout por defecto de 10 min y 2 reintentos |
| Agencia | Ninguna: no hay tools ni acciones del modelo. **Pero** la salida JSON decide cuántas filas se escriben en BD y con qué valores (JB-04) |
| Memoria/RAG | No. Caché Redis por usuario y día (`plan:{userId}:{YYYY-MM-DD}`, TTL 24 h, AES-GCM opcional) |
| Respaldo | Plan por reglas (`aiService.js:350-402`) ante cualquier error |
| Visualización en frontend | La app no renderiza texto libre del modelo: muestra objetivos calculados y comidas/sesiones desde BD (`HomeScreen.tsx`, `NutritionScreen.tsx`, `TrainingScreen.tsx`). Componentes `<Text>` de React Native, sin WebView, Markdown ni enlaces, así que **no hay riesgo de XSS ni de inyección de enlaces** desde la salida |

## 2. Matriz OWASP LLM Top 10 (2025)

| ID | Riesgo | Exposición en Healthy | Estado actual | Hallazgos | Valoración |
|---|---|---|---|---|---|
| **LLM01** | Prompt Injection | Directa: 4 campos libres del usuario en el prompt (`profession`, `injuries_or_limitations`, `food_name`, `condition_name`). Indirecta: catálogo de ejercicios (BD importada de un dataset externo) | Delimitadores `<user_data>`, instrucciones defensivas, lista negra en inglés, NFC, truncado y presupuesto de 2000. `extraContext` del cliente eliminado | JB-06, JB-10, SEC-01/03/15/17/18 ⚠️ | 🟠 Mitigación parcial que se puede eludir. Impacto acotado al plan del propio usuario (sin tools ni datos ajenos) |
| **LLM02** | Sensitive Information Disclosure | Datos de salud (peso, altura, edad, sexo, tabaquismo, sueño, estrés y, al corregir JB-01, condiciones y alergias) enviados a Anthropic (EE. UU.). El modelo solo ve datos del usuario que hace la petición | No se envían nombre ni email; userId solo en logs. Sin control de consentimiento en servidor. Transferencia internacional "pendiente" | JB-09, JB-19 | 🟠 Riesgo de cumplimiento, no de fuga entre usuarios |
| **LLM03** | Supply Chain | SDK de Anthropic, modelo de terceros, dataset de ejercicios, alimentos USDA/OFF (fuera del prompt) | SDK fijado sin dependencias transitivas; `npm audit` en CI; dependabot | JB-16, SEC-13 ✅, SEC-15 ⚠️ | 🟡 Bajo riesgo de compromiso; deuda de versión alta |
| **LLM04** | Data and Model Poisoning | Sin entrenamiento ni fine-tuning. Envenenamiento posible del catálogo en BD o de la caché Redis | Catálogo truncado; caché con GCM/HMAC opcional y aislada por usuario | JB-14, JB-13 | 🟡 Requiere acceso de escritura a BD o Redis |
| **LLM05** | Improper Output Handling | La salida se guarda (sesiones, comidas, notas) y controla bucles (`weeks`, `weekly_schedule`). Se devuelve entera al cliente (`generated_plan`) | Solo `JSON.parse` y 3 campos saneados | **JB-04**, SEC-07/11 ⚠️ | 🟠 Principal brecha técnica: DoS y datos sin control |
| **LLM06** | Excessive Agency | No hay tools ni acciones | — | — | 🟢 N/A. Si se añaden tools (registrar comidas, buscar alimentos), revisar la autorización por usuario y pedir confirmación |
| **LLM07** | System Prompt Leakage | El system prompt no contiene secretos ni datos de otros usuarios. Instrucción de no revelarlo. Se puede sobrescribir por variable de entorno | Instrucción ✅. La salida no se muestra como texto en la app (la filtración solo sería visible en la respuesta API `generated_plan`) | JB-17, SEC-09 ✅ | 🟢 Bajo impacto |
| **LLM08** | Vector and Embedding Weaknesses | No hay embeddings ni RAG | — | — | ⚪ N/A |
| **LLM09** | Misinformation (consejo médico) | Planes de nutrición y ejercicio para personas con posibles condiciones, alergias, menores y riesgo de TCA | El system prompt pide respetar lesiones y alergias, **pero no las recibe** (JB-01). Edad mínima eludible (JB-02). Sin reglas clínicas ni validación de calorías | **JB-01, JB-02**, JB-05, JB-15, JB-10 | 🔴 Riesgo principal del producto |
| **LLM10** | Unbounded Consumption | Coste por llamada (~4k tokens de salida); limitadores en memoria; `/health/ai` sin límite; sin medición de usage; sin timeout | 1 plan/día y 3 regeneraciones/día por usuario (en memoria); registro 3/h por "IP" (en realidad global); body de 50 kb | JB-07, JB-08, JB-11, JB-12, JB-13 | 🟠 Límites frágiles y sin observabilidad del gasto |

## 3. Modelo de amenazas

### 3.1 Activos

| Activo | Ubicación | Sensibilidad |
|---|---|---|
| Datos de onboarding (salud, hábitos) | PostgreSQL (`Profile`, `LifestyleProfile`, `TrainingPreferences`, `HealthCondition`, `FoodRestriction`, `MotivationProfile`) | Categoría especial (RGPD art. 9) |
| Plan generado (JSON) | Redis (`plan:{userId}:{fecha}`, 24 h) y PostgreSQL (`Plan`, `TrainingSession`, `Meal`) | Salud (deriva de lo anterior) |
| `ANTHROPIC_API_KEY` | Variables de Railway (no versionada; `.env.example` sin valores) | Crédito y cupo de la organización |
| `REDIS_ENCRYPTION_KEY`, `REDIS_HMAC_SECRET`, `ADMIN_TOKEN`, `JWT_SECRET` | Variables de Railway | Integridad y confidencialidad |
| System prompt | `aiService.js:78-159` o `AI_SYSTEM_PROMPT` | Bajo (sin secretos) |
| Presupuesto de IA y disponibilidad del servicio | Cuenta de Anthropic | Económico |
| Seguridad física del usuario | Resultado del plan | **Crítico** (daño real) |

### 3.2 Actores

| Actor | Capacidad | Motivación |
|---|---|---|
| Usuario legítimo | Usa la app normalmente | — (víctima de JB-01/JB-02/JB-05) |
| Usuario malicioso autenticado | Edita sus propios campos libres y llama a la API directamente con su JWT | Manipular el modelo, extraer el prompt, gastar coste, DoS |
| Atacante anónimo | Endpoints públicos (`/auth/register`, `/health`, `/health/ai` en staging) | Coste, cupo, reconocimiento, DoS de registro |
| Creador de múltiples cuentas | Registro masivo (sin verificación de IP real, JB-07) | Multiplicar el coste |
| Insider o acceso a Railway | Variables de entorno, Redis, BD | Cambiar el prompt (JB-17), leer o envenenar la caché (JB-14) |
| Proveedor de datos externo | Dataset de ejercicios importado | Inyección indirecta (baja; catálogo truncado) |

### 3.3 Superficies de ataque IA

1. **Campos libres guardados que se interpolan en el prompt:** `profession` (`PUT /onboarding/lifestyle`), `injuries_or_limitations` (`PUT /onboarding/training`), `food_name`/`condition_name` (`PUT /onboarding/health`). Hoy solo `profession` llega de verdad, porque los otros PUT fallan con el payload del frontend; un atacante que llame a la API directamente con el formato correcto **sí** puede llenar los cuatro. Es inyección almacenada en el contexto del propio usuario, reutilizada en cada regeneración.
2. **Enums que entran en el prompt sin escapar:** `goal`, `activity_level`, `body_type`, `diet_type`, `restriction_type`, `condition_type`, `main_motivation`, `tracking_preference`, `experience_level`, `home_equipment`. Todos son enums de Prisma (`backend/prisma/schema.prisma`), por lo que no admiten texto arbitrario. ✅
3. **Números en el prompt:** `age`, `weight_kg`, `height_cm` sin rango en `/complete` (JB-02, SEC-20). No permiten inyectar texto, pero sí condicionar el consejo clínico.
4. **Catálogo de ejercicios** (BD) que se pasa como `extraContext`.
5. **Salida del modelo**, que controla escrituras en BD (JB-04).
6. **Endpoint `/health/ai`** (JB-08).
7. **Caché Redis** (JB-13, JB-14).
8. **Configuración** (`AI_SYSTEM_PROMPT`, JB-17).

No son superficie IA (verificado): alimentos y micronutrientes (A-6, N-1), `GET /user/me/profile` (A-9), `has_plan` (A-15/A-16), notas de progreso y diario.

### 3.4 Flujo de datos de salud hacia Anthropic

```
App (Expo)
  └─ PUT /onboarding/{profile,lifestyle,training,nutrition,health,motivation}  ← varios fallan con 400 (JB-01/JB-03)
  └─ POST /onboarding/complete  (body con profile/training/nutrition del store local)
        │  [sin comprobación de consentimiento art. 9 — JB-09]
        ▼
Backend (Railway, UE/EE. UU. según región)
  ├─ PostgreSQL: lee el perfil del userId del JWT
  ├─ exerciseSelector → catálogo (BD)
  ├─ buildUserContextPrompt → sanitizeTextField → <user_data>…</user_data>
  │     datos enviados: edad, sexo, peso, altura, complexión, actividad, objetivo,
  │     profesión, estrés, sueño, tabaquismo, días/equipo/nivel, [lesiones], dieta,
  │     [alergias], [condiciones], motivación, TMB/TDEE
  │     NO enviados: nombre, email, teléfono, userId
  ▼
Anthropic Messages API (EE. UU.)  ← transferencia internacional (art. 44-46)
  ▼
Respuesta JSON → caché Redis 24 h → PostgreSQL → app
```

**Base legal y transferencia (según `docs/rgpd-compliance.md`):** consentimiento explícito art. 9.2.a más SCC (art. 46). Las SCC/DPA con Anthropic constan como **pendientes de formalizar** (`docs/rgpd-compliance.md:203,215,219`). El consentimiento no se comprueba en el servidor antes de enviar datos (JB-09) y en el flujo real ni siquiera se registra (JB-01).

**Minimización recomendada en el prompt:**

| Dato | ¿Necesario? | Recomendación |
|---|---|---|
| Edad, sexo, peso, altura, actividad, objetivo | Sí | Mantener, con rangos validados |
| Alergias, intolerancias, lesiones, condiciones | Sí (seguridad) | **Deben llegar** (JB-01); enviar en forma normalizada (ids de catálogo, no texto libre) |
| Profesión (texto libre) | No | Sustituir por `work_type` (enum) o eliminar. Reduce además la superficie LLM01 |
| Estrés, sueño, tabaquismo | Útil, discutible | Mantener solo si el consentimiento lo cubre expresamente |
| `condition_name` libre | Parcial | Preferir ids de catálogo (`diabetes`, `hypertension`…) que ya usa el frontend; evitar texto libre médico |
| Notas (`notes`, `previous_attempts_notes`) | No | No enviarlas (hoy no se envían ✅) |

**Retención en el proveedor:** revisar los términos comerciales y la opción de retención de datos de la API de Anthropic para la cuenta, y documentarlo en `DATA_REGISTER.md` (ámbito security).

### 3.5 Controles existentes que funcionan (no tocar)

- `userId` siempre del JWT; consultas filtradas por `user_id`; caché aislada por usuario (SEC-04).
- El cliente no envía `extraContext` (SEC-02).
- Las respuestas de error al cliente son genéricas en el flujo principal (`errorHandler`); el plan de respaldo evita 5xx cuando falla la IA.
- Prompts y datos de onboarding no se registran en logs.
- Body limitado a 50 kb; enums de Prisma en todos los campos categóricos.
- Sin tools ni agencia; el frontend no renderiza texto del modelo.

## 4. Prioridades

1. **Antes de producción (bloquean):** JB-01 (alergias, lesiones y condiciones al prompt; plan de respaldo sin alérgenos), JB-02 (edad ≥ 16 en el servidor).
2. **Antes del registro público:** JB-04 (validación de salida), JB-05 (salvaguardas clínicas), JB-07 (limitadores), JB-09 (consentimiento y DPA), JB-03.
3. **Endurecimiento:** JB-06, JB-08, JB-10..JB-16.
4. **Higiene:** JB-17..JB-20.

*Agente JailBreak — 2026-10-19.*
