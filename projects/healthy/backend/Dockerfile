# ── Etapa 1: build (genera cliente Prisma con CLI disponible) ─────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma/ ./prisma/
RUN npx prisma generate --schema=./prisma/schema.prisma

# ── Etapa 2: imagen final ──────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Solo dependencias de producción (prisma CLI ahora está en dependencies)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Cliente Prisma generado en la etapa builder
COPY --from=builder /app/src/generated ./src/generated

# Código fuente
COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
# SEC-67 (SA-32): si `prisma migrate deploy` falla, el contenedor termina con error
# y NO sirve tráfico con un esquema desfasado. Railway no da por bueno el deploy
# (healthcheck sin responder) y mantiene la versión anterior. `exec` deja a node
# como proceso hijo directo de dumb-init para recibir las señales.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && exec node server.js"]
