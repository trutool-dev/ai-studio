-- A-6: Añadir campos de micronutrientes a la tabla foods
-- NOTA: Esta migración debe ejecutarse en Railway con DATABASE_URL configurada:
--   cd projects/healthy/backend
--   npx prisma migrate deploy --schema prisma/schema.prisma

ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "fiber_g"         DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "sugar_g"         DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "saturated_fat_g" DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "sodium_mg"       DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "potassium_mg"    DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "calcium_mg"      DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "iron_mg"         DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "vitamin_c_mg"    DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "vitamin_d_mcg"   DOUBLE PRECISION;
ALTER TABLE "foods" ADD COLUMN IF NOT EXISTS "vitamin_b12_mcg" DOUBLE PRECISION;
