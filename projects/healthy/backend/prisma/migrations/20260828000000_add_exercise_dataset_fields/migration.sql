-- Añadir campos del dataset al modelo Exercise
-- Dataset: hasaneyldrm/exercises-dataset (1324 ejercicios)

ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "externalId" INTEGER;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "bodyPart" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "equipment" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "target" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "secondaryMuscles" TEXT[] DEFAULT '{}';
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "instructionsEs" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "instructionsEn" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "gifUrl" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Hacer muscle_group opcional (era NOT NULL en el esquema original)
ALTER TABLE "exercises" ALTER COLUMN "muscle_group" DROP NOT NULL;

-- Hacer difficulty opcional con valor por defecto (era NOT NULL sin default en el esquema original)
ALTER TABLE "exercises" ALTER COLUMN "difficulty" SET DEFAULT 'beginner';

-- Índice único para externalId
CREATE UNIQUE INDEX IF NOT EXISTS "exercises_externalId_key" ON "exercises"("externalId");

-- Índices adicionales para campos de búsqueda frecuente
CREATE INDEX IF NOT EXISTS "exercises_category_idx" ON "exercises"("category");
CREATE INDEX IF NOT EXISTS "exercises_target_idx" ON "exercises"("target");
