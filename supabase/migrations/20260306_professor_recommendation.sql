-- Agregar columna "recommended" a professor_ratings para saber si recomiendan al profesor
ALTER TABLE "public"."professor_ratings" ADD COLUMN IF NOT EXISTS "recommended" BOOLEAN DEFAULT NULL;
