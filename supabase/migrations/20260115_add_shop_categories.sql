-- =========================================
-- MIGRACIÓN: CATEGORÍAS DE TIENDA
-- =========================================

-- 1. Crear tabla de categorías
CREATE TABLE IF NOT EXISTS shop_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT, -- Nombre del icono de lucide o URL
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Agregar columna category_id a shop_items
ALTER TABLE shop_items 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES shop_categories(id) ON DELETE SET NULL;

-- 3. Habilitar RLS en shop_categories
ALTER TABLE shop_categories ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para shop_categories
DROP POLICY IF EXISTS "shop_categories_select_public" ON shop_categories;
CREATE POLICY "shop_categories_select_public"
  ON shop_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Comandos para insertar categorías iniciales (opcional)
-- INSERT INTO shop_categories (name, icon, display_order) VALUES ('Marcos de Perfil', 'UserSquare2', 1);
-- INSERT INTO shop_categories (name, icon, display_order) VALUES ('Stickers', 'Sticker', 2);
