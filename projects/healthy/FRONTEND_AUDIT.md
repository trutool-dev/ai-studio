# Frontend Audit — Healthy App
**Fecha:** 2026-06-15  
**Agente:** frontend  
**Alcance:** `projects/healthy/frontend/src/`

---

## Resumen ejecutivo

| Severidad | Hallazgos | Estado |
|-----------|-----------|--------|
| 🔴 Crítico | 1 | ✅ Corregido |
| 🟡 Importante | 2 | ⚠️ Pendiente (requiere backend data) |
| 🟢 Menor | 2 | ✅ Corregido / documentado |

---

## 1. URLs hardcodeadas

**Veredicto: ✅ Sin problema real**

La única URL que aparece en el código es el fallback en `src/services/api.ts:9`:

```ts
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
```

El patrón es correcto: `EXPO_PUBLIC_API_URL` tiene precedencia y el fallback solo aplica si la variable no está definida (útil en desarrollo local). No hay ninguna URL hardcodeada en pantallas ni servicios.

---

## 2. Variables de entorno

**Veredicto: 🟢 Funcional, pero faltaba `.env.example`**

- `.env` existe y contiene `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- **No existía `.env.example`** — los nuevos colaboradores no sabían qué variables configurar.

**✅ Fix aplicado:** Creado `.env.example` con la variable documentada.

---

## 3. Manejo de errores 400 — formato PR-4

**Veredicto: 🔴 BUG CRÍTICO — corregido**

Tras PR-4, el backend devuelve errores de validación con este formato:
```json
{ "error": "VALIDATION_ERROR", "details": ["email: formato inválido", "..."] }
```

Sin embargo, **5 pantallas** usaban `err.response?.data?.message`, que en este formato devuelve `undefined`, mostrando siempre el fallback genérico en lugar del error real del backend.

### Pantallas afectadas
| Archivo | Línea original | Error en pantalla |
|---------|---------------|-------------------|
| `screens/auth/LoginScreen.tsx` | `err.response?.data?.message ?? 'Error al iniciar sesión'` | Siempre mostraba fallback |
| `screens/auth/RegisterScreen.tsx` | `err.response?.data?.message ?? 'Error al registrar'` | Siempre mostraba fallback |
| `screens/auth/SetPasswordScreen.tsx` | `err.response?.data?.message ?? 'Error al crear contraseña'` | Siempre mostraba fallback |
| `screens/auth/VerifyEmailScreen.tsx` | `err.response?.data?.message ?? 'Código incorrecto'` | Siempre mostraba fallback |
| `screens/onboarding/OnboardingComplete.tsx` | `err.response?.data?.message ?? 'No se pudo generar el plan.'` | Siempre mostraba fallback |

### Fix aplicado

Creado `src/utils/errors.ts` con el helper:

```ts
export function extractApiError(err: any, fallback: string): string {
  const data = err?.response?.data;
  if (!data) return fallback;

  // Formato PR-4: { error: 'VALIDATION_ERROR', details: [...] }
  if (Array.isArray(data.details) && data.details.length > 0) {
    return data.details[0];
  }

  // Formato legacy: { message: '...' } o { error: '...' }
  return data.message ?? data.error ?? fallback;
}
```

Todas las pantallas afectadas actualizadas para usar `extractApiError(err, fallback)`.

---

## 4. Pantallas incompletas / datos hardcodeados

**Veredicto: 🟡 Importante — pendiente de API**

### ProfileScreen — datos de perfil estáticos

`src/screens/app/ProfileScreen.tsx` muestra datos hardcodeados que deberían venir del store o de la API:

```tsx
<StatBox icon="💪" value="12"       label="Entrenos"   />  // hardcoded
<StatBox icon="⚖️" value="−2.6 kg" label="Perdidos"   />  // hardcoded
<PlanRow icon="📏" label="Altura"    value="178 cm"    />  // hardcoded
<PlanRow icon="⚖️" label="Peso"     value="79.9 kg"   />  // hardcoded
<PlanRow icon="🎂" label="Edad"     value="28 años"   />  // hardcoded
<PlanRow icon="🥗" label="Dieta"    value="Omnívoro"  />  // hardcoded
<PlanRow icon="📅" label="Sesiones/semana" value="4 días" />  // hardcoded
<PlanRow icon="🎯" label="Objetivo" value="Ganar músculo" /> // hardcoded
```

Estos datos deberían provenir de `onboardingStore` (perfil guardado durante el onboarding) y de `planStore` (estadísticas de progreso). La pantalla tampoco llama a ningún endpoint para cargar estadísticas del usuario.

**Acción requerida:** conectar `ProfileScreen` al store de onboarding y al endpoint `/progress/stats`. Tarea para el orquestador.

### Configuración no funcional

Los toggles de "Notificaciones" y "Modo oscuro" y los `SettingRow` de "Privacidad", "Ayuda" y "Términos" son UI decorativa sin lógica real. Pendiente según prioridades del proyecto.

---

## 5. TODOs, FIXMEs y placeholders de código

**Veredicto: ✅ Código limpio**

No existe ningún comentario `TODO`, `FIXME`, ni componente con lógica marcada como pendiente. Las únicas ocurrencias de `placeholder` son props de `TextInput` (comportamiento normal de React Native).

---

## 6. Imports rotos

**Veredicto: ✅ Sin imports rotos**

Todos los alias `@/` resuelven a archivos existentes. Verificado:

- `@/theme/spacing` exporta `duration` y `borderRadius` — usados correctamente.
- `@/theme/typography` exporta `fontSize` y `textStyles` — usados correctamente.
- `@/components/ui/MealCard` existe y se usa en `NutritionScreen`.
- Ninguna pantalla importa módulos eliminados en PR-1 del backend.

---

## Cambios aplicados en esta auditoría

| Archivo | Cambio |
|---------|--------|
| `src/utils/errors.ts` | ✅ Creado — helper `extractApiError` compatible con PR-4 |
| `src/screens/auth/LoginScreen.tsx` | ✅ Usa `extractApiError` |
| `src/screens/auth/RegisterScreen.tsx` | ✅ Usa `extractApiError` |
| `src/screens/auth/SetPasswordScreen.tsx` | ✅ Usa `extractApiError` |
| `src/screens/auth/VerifyEmailScreen.tsx` | ✅ Usa `extractApiError` |
| `src/screens/onboarding/OnboardingComplete.tsx` | ✅ Usa `extractApiError` |
| `.env.example` | ✅ Creado |

---

## Acciones pendientes (para el orquestador)

1. **[FE-PROFILE-01]** Conectar `ProfileScreen` a `onboardingStore` para mostrar datos reales de perfil (altura, peso, edad, dieta, objetivo, frecuencia).
2. **[FE-PROFILE-02]** Llamar a `/progress/stats` desde `ProfileScreen` para mostrar estadísticas reales (entrenamientos completados, kg perdidos).
3. **[FE-PROFILE-03]** Implementar lógica real de notificaciones y modo oscuro, o marcar explícitamente como "próximamente" en la UI.
