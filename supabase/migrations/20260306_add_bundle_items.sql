-- =========================================
-- MIGRACIÓN: AGREGAR SOPORTE PARA PAQUETES (BUNDLES) EN LA TIENDA
-- =========================================

-- Añadir la columna bundle_items a la tabla shop_items
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS bundle_items UUID[] DEFAULT NULL;

-- Actualizar la vista o función RLS si fuera necesario (no lo es para consultas estándar)
