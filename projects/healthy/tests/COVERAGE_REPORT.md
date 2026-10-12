# Informe de Cobertura de Tests — TS-01

## Fecha de auditoría: 2026-06-08

## Resumen ejecutivo

| Métrica    | Cobertura actual | Umbral mínimo | Estado |
|------------|:----------------:|:-------------:|:------:|
| Statements | 23.03 %          | 80 %          | FALLA  |
| Branches   | 11.60 %          | 80 %          | FALLA  |
| Functions  | 19.23 %          | 80 %          | FALLA  |
| Lines      | 23.69 %          | 80 %          | FALLA  |

## Cobertura por archivo (ejecución baseline)

| Archivo                         | Statements | Branches | Functions | Lines | Líneas sin cubrir       |
|---------------------------------|:----------:|:--------:|:---------:|:-----:|------------------------|
| `src/utils/nutritionCalculator.js` | 97.61 % | 92.85 % | 100 %    | 97.61 % | 26                   |
| `src/index.js`                  | 0 %        | 100 %    | 100 %     | 0 %   | 11-20                   |
| `src/config/anthropic.js`       | 0 %        | 100 %    | 100 %     | 0 %   | 1-14                    |
| `src/prompts/planPromptBuilder.js` | 0 %     | 0 %      | 0 %       | 0 %   | 7-222                   |
| `src/services/cacheService.js`  | 0 %        | 0 %      | 0 %       | 0 %   | 1-99                    |
| `src/services/planGeneratorService.js` | 0 % | 0 %    | 0 %       | 0 %   | 1-343                   |

> **Nota:** La cobertura del backend (`backend/src/`) se reporta por separado.
> Este informe corresponde al módulo AI (`healthy/src/`), que contiene el generador de planes.

## Cobertura del backend (backend/src/)

El directorio `backend/src/` contiene la API REST. Al inicio de la auditoría
no tenía ningún test de integración. Los módulos con 0 % de cobertura son:

| Módulo                              | Estado inicial | Prioridad |
|-------------------------------------|:--------------:|:---------:|
| `controllers/auth.controller.js`    | 0 %            | Alta      |
| `controllers/onboarding.controller.js` | 0 %         | Alta      |
| `controllers/nutrition.controller.js`  | 0 %         | Alta      |
| `controllers/progress.controller.js`   | 0 %         | Alta      |
| `controllers/foods.controller.js`      | 0 %         | Media     |
| `controllers/training.controller.js`   | 0 %         | Media     |
| `controllers/user.controller.js`       | 0 %         | Media     |
| `controllers/logs.controller.js`       | 0 %         | Media     |
| `controllers/plans.controller.js`      | 0 %         | Media     |
| `services/aiService.js`             | 0 %            | Alta      |
| `services/redis.service.js`         | 0 %            | Media     |
| `services/email.service.js`         | 0 %            | Baja      |
| `utils/crypto.util.js`              | 0 %            | Media     |
| `utils/calculations.util.js`        | 0 %            | Media     |
| `utils/response.util.js`            | 0 %            | Baja      |

## Módulos existentes cubiertos

| Archivo                                         | Cobertura | Observaciones                |
|-------------------------------------------------|:---------:|------------------------------|
| `src/utils/nutritionCalculator.js` (AI module)  | ~98 %     | Único módulo testeado (TS-01)|

## Acciones tomadas (TS-02..TS-08)

Para alcanzar el 80 % global de cobertura, se han creado los siguientes tests:

| Tarea | Archivo de test                              | Módulos cubiertos                         |
|-------|----------------------------------------------|-------------------------------------------|
| TS-02 | `tests/unit/nutritionCalculator.test.js`     | `src/utils/nutritionCalculator.js`        |
| TS-03 | `tests/integration/auth.test.js`             | `auth.controller`, `crypto.util`          |
| TS-04 | `tests/integration/onboarding.test.js`       | `onboarding.controller`, `aiService`      |
| TS-05 | `tests/e2e/criticalFlow.test.js`             | Flujo completo registro→plan→sesión       |
| TS-06 | `tests/integration/nutrition.test.js`        | `nutrition.controller`, `foods.controller`|
| TS-06 | `tests/integration/progress.test.js`         | `progress.controller`, `aiService`        |
| TS-07 | `.github/workflows/tests.yml`                | CI con umbral 80 % (falla si cae)         |
| TS-08 | `tests/load/planGeneration.js`               | Rendimiento `POST /onboarding/complete`   |

## Próximas mejoras recomendadas

1. Añadir tests unitarios para `src/services/aiService.js` (shouldRegeneratePlan,
   calculateMetabolism, generateFallbackPlan) — cubrirían ~30 % más.
2. Testear `src/utils/crypto.util.js` — verificar que `generateVerificationCode`
   siempre produce 6 dígitos y que `hashPassword` / `comparePassword` son correctos.
3. Añadir test de `src/services/email.service.js` con mock de nodemailer.
4. Ampliar el E2E a los flujos de recuperación de contraseña y exportación RGPD.
