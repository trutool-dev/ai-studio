# Resumen ejecutivo — Auditoría de seguridad Healthy — 2026-10-19

| Campo | Valor |
|---|---|
| Coordinación | Agente orquestador (Opus) |
| Auditores | Agente security (OWASP Top 10, RGPD/LOPDGDD, secretos, dependencias) y agente JailBreak (MITRE ATLAS v4.5 + OWASP LLM Top 10 2025) |
| Commit auditado | `4993123` (`develop`) |
| Método | Estático e independiente: se verificó el código, no los documentos de estado. Sin pruebas de ataque a staging/producción ni llamadas a Anthropic (solo `GET /health`). `npm audit --omit=dev` en solo lectura |
| Informes | `SECURITY_AUDIT_2026-10-19.md`, `ATLAS_AUDIT.md`, `LLM_THREATS.md`, `PROMPT_REVIEW.md` |
| Lista de trabajo | `SECURITY_TASKS.md` (SEC-25..SEC-72) |

## Veredicto

**Healthy NO es apto para desplegar a producción** en el estado del commit auditado. Hay 5 hallazgos críticos, dos de ellos explotables hoy en staging sin credenciales, y dos que afectan a la seguridad física de los usuarios.

## Cifras

| | 🔴 | 🟠 | 🟡 | 🟢 | Total |
|---|---|---|---|---|---|
| Agente security (SA) | 3 | 5 | 16 | 10 | 34 |
| Agente JailBreak (JB) | 2 | 7 | 7 | 4 | 20 |
| **Consolidado (deduplicado)** | **5** | **10** | **20** | **13** | **48** (SEC-25..SEC-72, incluye 2 VUL previas reabiertas) |

**Verificación de las correcciones previas SEC-01..SEC-24** (todas marcadas como hechas en `PROJECT_STATUS.md`): 7 ✅ verificadas, 13 ⚠️ parciales o eludibles, 4 ❌ no efectivas (SEC-03, SEC-20, SEC-23, SEC-24). De `VULNERABILITIES.md`, VUL-2026-003 (consentimiento Art. 9) y VUL-2026-011 (rate limit en reset/set-password) figuraban como resueltas y **no lo están**.

## Los cinco críticos

1. **SEC-27 — Toma de control de cualquier cuenta.** `POST /auth/set-password` cambia la contraseña conociendo solo el email de un usuario verificado, sin token, OTP ni límite de peticiones.
2. **SEC-25 / SEC-26 — Secretos en el repositorio.** `JWT_SECRET` reales en `devops/GITHUB_SECRETS.md` (M-21 sin rotar) y credenciales de PostgreSQL de staging y producción en 5 archivos versionados, con host en el proxy TCP público de Railway. Limpiar los archivos no basta: siguen en el historial; **hay que rotarlos** (manual, Antonio).
3. **SEC-28 — Alergias, lesiones y condiciones médicas no llegan a la IA.** Por un desajuste entre lo que envía el frontend y lo que espera el backend, el modelo genera planes sin conocerlas, y el plan de respaldo incluye frutos secos y lácteos fijos.
4. **SEC-29 — Edad mínima eludible.** `/onboarding/complete` crea el perfil sin comprobar la edad ni los rangos fisiológicos: un menor recibe planes calóricos.

## Otros riesgos altos

- Endpoints de depuración con bloqueo de lista negra (`NODE_ENV !== 'production'`): abiertos en staging (SEC-30, SEC-39).
- OTP sin límite efectivo de intentos (SEC-31) y rate limiting ineficaz tras el proxy de Railway, con store en memoria (SEC-32).
- Consentimiento Art. 9 no validado en el servidor y fijado a `true` en el frontend; datos de salud enviados a Anthropic sin DPA/SCC formalizado (SEC-33, SEC-35).
- Salida del LLM sin validación de esquema ni salvaguardas clínicas (SEC-36, SEC-37); sanitizador de entrada eludible (SEC-38).
- La build de producción apunta a `api.healthy.app`, dominio sin titularidad verificada (SEC-34).

## Higiene de secretos

- La memoria del orquestador (`current_status.md`) guarda credenciales del usuario de staging en texto plano (SEC-41). Hay que sustituirlas por una referencia a un gestor de contraseñas.
- `.claude/settings.local.json` está versionado con tokens y URLs de BD (SEC-40).
- El hook de pre-commit excluye `*.md`, que es justo donde estaban los secretos (SEC-42).

## Dependencias

Backend: 15 vulnerabilidades (`npm audit --omit=dev`: 1 crítica, 7 altas). Frontend: 48, mayoritariamente de la cadena de build. Las 10 PRs de dependabot (#8–#17) tienen el CI en rojo, en parte porque el propio job `npm audit --audit-level=high` falla. No se recomienda mergear `@anthropic-ai/sdk` 0.52→0.133 sin tests con el SDK simulado (SEC-53, SEC-59, SEC-66).

## Acciones que solo puede hacer Antonio

| Acción | Tarea |
|---|---|
| Rotar `JWT_SECRET`/`JWT_REFRESH_SECRET` en Railway y GitHub | SEC-25 |
| Rotar contraseñas de PostgreSQL (staging y producción) y desactivar el proxy TCP público si no se usa | SEC-26 |
| Confirmar el dominio de la API de producción | SEC-34 |
| DPA/SCC con Anthropic y base legal de la transferencia internacional | SEC-33 (parte legal) |
| Decidir `git rm --cached .claude/settings.local.json` | SEC-40 |
| Borrar las credenciales de staging de la memoria y cambiar esa contraseña | SEC-41 |
| Autorizar las pruebas dinámicas propuestas en los informes | — |

## Plan

Fase 1: SEC-27 → SEC-30 → SEC-28 → SEC-29. Fase 2: resto de 🔴/🟠 corregibles en código. Fase 3: 🟡/🟢 sin decisión de producto. El seguimiento está en `PROJECT_STATUS.md`, sección "Auditoría de seguridad 2026-10-19 (Opus)".
