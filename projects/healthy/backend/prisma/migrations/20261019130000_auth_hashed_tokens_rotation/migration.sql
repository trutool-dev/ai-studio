-- SEC-45 (SA-14): refresh tokens y tokens de reset guardados como SHA-256,
-- rotación de refresh tokens por familias con detección de reutilización.
-- Migración creada a mano, SIN aplicar.
--
-- IMPORTANTE (impacto): los refresh tokens y los tokens de reset existentes están
-- guardados en claro y dejan de ser válidos (el servidor ahora busca por hash).
-- Todas las sesiones existentes se marcan como revocadas: los usuarios tendrán que
-- volver a iniciar sesión, y los enlaces de recuperación pendientes dejan de funcionar.

-- AlterTable: familia de rotación y marca de revocación
ALTER TABLE "auth_sessions" ADD COLUMN "family_id" TEXT;
ALTER TABLE "auth_sessions" ADD COLUMN "revoked_at" TIMESTAMP(3);

-- Las sesiones existentes forman cada una su propia familia
UPDATE "auth_sessions" SET "family_id" = "id" WHERE "family_id" IS NULL;
ALTER TABLE "auth_sessions" ALTER COLUMN "family_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "auth_sessions_family_id_idx" ON "auth_sessions"("family_id");

-- Revocar sesiones con refresh token en claro (obliga a re-login)
UPDATE "auth_sessions" SET "revoked_at" = CURRENT_TIMESTAMP WHERE "revoked_at" IS NULL;

-- Invalidar tokens de reset pendientes guardados en claro
UPDATE "password_reset_tokens" SET "used_at" = CURRENT_TIMESTAMP WHERE "used_at" IS NULL;
