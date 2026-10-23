# Progreso — tareas posteriores a la auditoría (sesión 2026-10-21)

> Punto de control del orquestador. Rama `feat/post-audit-tasks-2026-10-21`, creada desde
> `fix/security-audit-2026-10-19` (`7b20bfd`). PR apilada: se mergea después de la PR #19.
> Al reanudar tras un corte: leer este archivo y `git log --oneline fix/security-audit-2026-10-19..HEAD`.

Leyenda: ⏳ EN CURSO · ✅ `<hash>` hecho · ⏭️ saltada (decisión de Antonio) · ⬜ pendiente

| # | Tarea | Estado | Verificación |
|---|-------|--------|--------------|
| 1 | A-29 — `swagger.yaml` válido + contrato nuevo de auth | ✅ `39f3caf` | js-yaml carga OK; 45 rutas, 22 `$ref` resueltas, sin operationId duplicados. Ningún test lee el swagger |
| 2 | A-28 — ESLint en el backend (`npm run lint`) | ✅ `89ff447` | `npm run lint` 0 errores/0 avisos · backend 901/901 · raíz 721/721 |
| 3 | SEC-50 — programar `runRetention` (scheduler en proceso + script npm) | ✅ `21cd9ab` | lint OK · backend 912/912 (+11) · raíz 732/732 (+11). Desactivado por defecto: 👤 activar `RETENTION_SCHEDULER_ENABLED=true` en Railway |
| 4 | A-26 — landing: `robots.txt` 200 y `sitemap.xml` | ✅ `dd093fb` | Docker local (nginx 1.27): `/robots.txt` 200 text/plain, `/sitemap.xml` 200 text/xml, `/` 200 html |
| 5 | `.easignore` — limitar lo que sube EAS | ✅ `86d1e3b` | `check-eas-archive.js` (código de eas-cli 21, sin subir nada): 61 archivos, 0,84 MB, solo `frontend/`. 👤 confirmar en el próximo build que compila sin `.git` |
| 6 | Frontend — error TS en `TrainingScreen.tsx:298` | ✅ `725883b` | `npx tsc --noEmit` 0 errores |
| 7 | SEC-47/48 — pantallas de borrar cuenta y retirar consentimiento | ✅ `2f1b78f` | tsc 0 errores · lint OK · backend 915/915 · raíz 735/735. Sin prueba en dispositivo (👤 probar en el próximo APK) |
| 8a | SEC-53 — quitar `uuid` (solo lo usaba el mock de tests) | ✅ `daefdc3` | `npm audit --omit=dev` 2 → 1 (queda nodemailer) · backend 915/915 · raíz 735/735 |
| 8b | M-10 — contraste del pie de la landing (0.45 → 0.60) | ✅ `cc0a1dd` | Único texto con 0.45; pendiente re-medir Lighthouse tras deploy (👤) |
| 9 | Documentación: PROJECT_STATUS, tasks.md, memoria | ✅ commit `docs(healthy)` de cierre (ver `git log -1`) | Memoria del orquestador actualizada fuera del repo |

## Notas

- **Saltadas (decisión o riesgo):** nodemailer 6→10 (mayor, SMTP sin probar aquí), SDK Anthropic
  0.52→0.133 (SEC-59), Expo SDK/`expo-secure-store` (SEC-66), certificate pinning (SEC-65, depende de
  SEC-34), compresión de vídeos de la landing (M-10 rendimiento, afecta al contenido), PRs de
  dependabot (A-27, GitHub), dominio (SEC-34), umbrales clínicos (SEC-37), keto/other (SEC-28),
  historial de consentimientos (SEC-47), `git rm --cached` (SEC-40).
- **SEC-50:** el programador queda **desactivado** por defecto; activarlo es poner
  `RETENTION_SCHEDULER_ENABLED=true` en Railway (decisión de Antonio).
- **`.easignore`:** el de `frontend/` no lo usa eas-cli; se dejó con un aviso (borrarlo requiere OK).
- **Incidencia de la sesión:** el Edit grande del swagger tardó ~100 min sin escribir en disco y el
  vigilante interrumpió; se rehízo en ediciones pequeñas validando el YAML tras cada una.
