-- SEC-27 (SA-03) / SEC-31 (SA-05) / SEC-45 (SA-14)
-- Migración creada a mano, SIN aplicar.
--
-- 1) Nuevo tipo de código `password_setup`: prueba de posesión de un solo uso que
--    emite verify-email y que exige set-password.
-- 2) Los OTP pasan a guardarse como HMAC-SHA256. Los códigos pendientes guardados
--    en claro dejan de ser válidos: se marcan como usados para que el job de
--    retención los purgue. Los usuarios a mitad de registro deberán pedir un
--    código nuevo (POST /auth/resend-code).

-- AlterEnum
ALTER TYPE "VerificationCodeType" ADD VALUE IF NOT EXISTS 'password_setup';

-- Invalidar OTP pendientes en claro
UPDATE "verification_codes" SET "used_at" = CURRENT_TIMESTAMP WHERE "used_at" IS NULL;
