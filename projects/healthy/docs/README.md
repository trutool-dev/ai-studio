# Healthy — App de salud y fitness personalizada con IA

Healthy es una aplicación móvil (iOS + Android) y web que genera planes personalizados de entrenamiento y nutrición usando Inteligencia Artificial. El plan se adapta automáticamente cuando detecta que el usuario está en un plateau de progreso.

**Versión actual:** 1.0.0-preview | **Estado:** En pruebas (Android APK disponible, iOS aplazado) | **Última actualización:** 2026-10-11

---

## Stack tecnológico

| Capa | Tecnología | Versión mínima | Descripción |
|------|-----------|----------------|-------------|
| **App móvil** | React Native + Expo | SDK 54 | iOS y Android desde una sola base de código |
| **Landing web** | HTML + CSS + JS (vanilla) | — | Una sola página autocontenida, sin build |
| **Backend** | Node.js + Express | Node 18 LTS | API REST, lógica de negocio |
| **ORM** | Prisma | 5.x | Migraciones y queries con TypeScript |
| **Base de datos** | PostgreSQL | 15+ | 21 entidades, esquema relacional completo |
| **Caché / Sesiones** | Redis | 7+ | Planes IA (24h), sesiones (30d), perfiles (1h) |
| **Autenticación** | Supabase Auth | — | OTP email, JWT, gestión de tokens |
| **IA** | Anthropic Claude | claude-sonnet-4-6 | Generación de planes personalizados |
| **Infraestructura** | AWS (eu-west-1) | — | S3, CloudFront, ECS Fargate, RDS, ElastiCache |
| **CI/CD** | GitHub Actions | — | Deploy automático en push a `main` |
| **Animaciones** | Reanimated 4 + Gesture Handler | — | Animaciones nativas 120fps (UI thread), springs, haptics |
| **Tests** | Jest + Playwright | — | Unit, integración y E2E — 454/454 ✅ |

---

## Funcionalidades principales

| Área | Funcionalidad |
|------|--------------|
| **Onboarding IA** | 7 pasos de personalización: perfil físico, estilo de vida, entrenamiento, nutrición, salud, motivación → plan personalizado generado por Claude |
| **Plan de entrenamiento** | Plan semanal con ejercicios reales del catálogo (1.324 ejercicios), por sesión y día, adaptado al equipamiento y nivel del usuario |
| **Plan nutricional** | Calorías, macros y sugerencias de comida calculados por IA según objetivo (perder peso / ganar músculo / mantenimiento) |
| **Regeneración de plan** | Detección automática de plateau (≤0.5 kg en 14 días) + botón manual "Regenerar mi plan" en el perfil |
| **Seguimiento diario** | Registro de agua, sueño, energía y pasos; log de comidas con búsqueda de alimentos; registro de peso y fotos de progreso |
| **Diseño Apple Design** | Animaciones nativas 120fps (Reanimated 4 + ProMotion), press feedback `scale(0.97)`, haptics, bottom sheets con drag-to-dismiss, reduced motion |
| **Autenticación** | Registro con OTP por email, login, refresh tokens con rotación automática |
| **RGPD** | Derecho al olvido (`DELETE /user/me`), portabilidad (`GET /user/me/export`), consentimiento Art. 9 para datos de salud |

---

## Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USUARIOS                                   │
│        App móvil (iOS/Android)        Navegador web                 │
└──────────────────┬───────────────────────────┬──────────────────────┘
                   │ HTTPS                     │ HTTPS
                   ▼                           ▼
         ┌─────────────────┐        ┌──────────────────────┐
         │  api.healthy.app│        │     healthy.app       │
         │  Route53 → ALB  │        │  Route53 → CloudFront │
         └────────┬────────┘        └──────────┬────────────┘
                  │                            │
                  ▼                            ▼
         ┌─────────────────┐        ┌──────────────────────┐
         │   ECS Fargate   │        │     S3 Bucket        │
         │ Node.js+Express │        │  healthy-landing-prod │
         │ (subnet privada)│        └──────────────────────┘
         └────────┬────────┘
          ┌───────┴────────┐
          ▼                ▼
   ┌────────────┐   ┌────────────┐
   │ PostgreSQL │   │   Redis    │
   │    RDS     │   │ElastiCache │
   │ (privado)  │   │ (privado)  │
   └────────────┘   └────────────┘
          │
          ▼
   ┌──────────────────┐
   │  Anthropic API   │
   │ claude-sonnet-4-6│
   └──────────────────┘
```

### Flujo principal de datos

```
Usuario → Onboarding (7 pasos) → Backend → calculateMetabolism()
       → Redis cache check → Anthropic Claude API
       → GeneratedPlan (JSON) → PostgreSQL → App móvil
```

---

## Requisitos previos

| Requisito | Versión mínima | Verificar con |
|-----------|---------------|---------------|
| Node.js | 18 LTS | `node --version` |
| npm | 9+ | `npm --version` |
| PostgreSQL | 15+ | `psql --version` |
| Redis | 7+ | `redis-server --version` |
| Git | 2.x | `git --version` |

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-org/healthy.git
cd healthy/projects/healthy
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores (ver tabla de variables más abajo).

### 4. Crear la base de datos

```bash
# Asegúrate de que PostgreSQL está corriendo
createdb healthy_dev

# Ejecutar migraciones
npx prisma migrate dev

# (Opcional) Ver el esquema en Prisma Studio
npx prisma studio
```

### 5. Cargar datos de prueba

```bash
npx ts-node database/seed.ts
```

### 6. Arrancar el servidor de desarrollo

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`.

---

## Variables de entorno

El archivo `.env` debe estar en `projects/healthy/backend/`. Nunca subir este archivo al repositorio.

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de conexión PostgreSQL (formato Prisma) | `postgresql://user:pass@localhost:5432/healthy_dev` |
| `REDIS_URL` | URL de conexión Redis | `redis://localhost:6379` |
| `CLAUDE_API_KEY` | API key de Anthropic | `sk-ant-api03-...` |
| `SUPABASE_URL` | URL del proyecto Supabase | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Clave pública de Supabase | `eyJhbGc...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada de Supabase (solo backend) | `eyJhbGc...` |
| `JWT_SECRET` | Secreto para firmar JWT internos | Cadena aleatoria 64+ caracteres |
| `NODE_ENV` | Entorno de ejecución | `development` / `production` |
| `PORT` | Puerto del servidor Express | `3000` |
| `AWS_REGION` | Región AWS (para S3 fotos de progreso) | `eu-west-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key (solo producción) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key (solo producción) | `...` |
| `S3_PROGRESS_PHOTOS_BUCKET` | Bucket de fotos de progreso | `healthy-progress-photos` |

---

## Comandos principales

### Desarrollo

```bash
# Servidor de desarrollo con hot reload
npm run dev

# Compilar TypeScript
npm run build

# Linter (ESLint + TypeScript)
npm run lint

# Formatear código (Prettier)
npm run format
```

### Base de datos

```bash
# Crear nueva migración
npx prisma migrate dev --name descripcion-del-cambio

# Aplicar migraciones en producción
npx prisma migrate deploy

# Cargar datos de prueba
npx ts-node database/seed.ts

# Abrir Prisma Studio (UI visual de la BD)
npx prisma studio

# Regenerar Prisma Client (tras cambios en schema.prisma)
npx prisma generate
```

### Tests

```bash
# Todos los tests
npm test

# Tests unitarios
npm run test:unit

# Tests de integración
npm run test:integration

# Tests E2E
npm run test:e2e

# Tests con cobertura
npm run test:coverage
```

---

## Estructura de carpetas

```
projects/healthy/
├── ai/                          # Módulo de Inteligencia Artificial
│   ├── types.ts                 # Interfaces, enums y calculateMetabolism()
│   ├── planGenerator.ts         # generatePlan(), shouldRegeneratePlan()
│   ├── fallbackPlan.ts          # Plan por reglas (sin Claude)
│   └── tokenLogger.ts           # Log de tokens y costes USD
│
├── backend/                     # API Node.js + Express
│   ├── src/
│   │   ├── routes/              # Definición de endpoints
│   │   ├── controllers/         # Lógica de cada ruta
│   │   ├── middleware/          # Auth, rate limit, validación
│   │   └── services/            # Lógica de negocio
│   ├── package.json
│   └── .env.example
│
├── database/                    # Esquema y datos
│   ├── schema.prisma            # 21 entidades PostgreSQL
│   ├── redis.ts                 # Cliente Redis con helpers
│   ├── seed.ts                  # Datos de prueba
│   ├── migrations/              # Historial de migraciones Prisma
│   └── ERD.md                   # Diagrama entidad-relación
│
├── design/                      # Sistema de diseño (DS-01..DS-10)
│   ├── tokens/                  # Colores, tipografía, espaciado, letterSpacing
│   ├── components/              # Componentes React Native con animaciones Reanimated 4
│   └── screens/                 # Especificaciones de pantallas
│
├── landing/                     # Landing page estática
│   └── index.html               # Fichero único autocontenido
│
├── docs/                        # Documentación del proyecto
│   ├── README.md                # Este fichero
│   ├── ai-architecture.md       # Arquitectura del módulo IA
│   ├── architecture-web.md      # Infraestructura AWS
│   ├── landing-deploy.md        # Guía de despliegue de la landing
│   ├── landing-content.md       # Guía de contenido de la landing
│   ├── api-reference.md         # Referencia de endpoints (TODO: Backend)
│   ├── deployment-guide.md      # Guía de despliegue completa
│   ├── rgpd-compliance.md       # Cumplimiento RGPD
│   └── PROGRESS.md              # Diario del proyecto
│
└── tests/                       # Tests
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Documentación adicional

| Documento | Descripción |
|-----------|-------------|
| [ai-architecture.md](./ai-architecture.md) | Flujo completo del módulo IA, prompt caching, fallback y costes |
| [architecture-web.md](./architecture-web.md) | Infraestructura AWS: VPC, ECS, RDS, CloudFront, CI/CD |
| [landing-deploy.md](./landing-deploy.md) | Cómo desplegar la landing page (manual y automático) |
| [landing-content.md](./landing-content.md) | Cómo editar textos y CTAs de la landing (para marketing) |
| [database/ERD.md](../database/ERD.md) | Diagrama entidad-relación de las 21 entidades PostgreSQL |
| [api-reference.md](./api-reference.md) | Referencia completa de endpoints REST (en construcción) |
| [deployment-guide.md](./deployment-guide.md) | Guía de despliegue local, staging y producción (en construcción) |
| [rgpd-compliance.md](./rgpd-compliance.md) | Flujo de consentimiento y derechos del usuario (en construcción) |
