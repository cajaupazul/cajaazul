-- =========================================
-- MIGRACIÓN: SISTEMA DE TIENDA VIRTUAL
-- =========================================
-- Este script crea todo el esquema necesario para el sistema de tienda
-- con marcos de perfil y otros artículos de personalización.

-- =========================================
-- 1. TABLA: shop_items
-- =========================================
-- Catálogo de artículos disponibles en la tienda

CREATE TABLE IF NOT EXISTS shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('profile_frame', 'background', 'badge', 'other')),
  price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
  image_url TEXT,
  frame_key TEXT UNIQUE, -- Identificador único para aplicar estilos CSS
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para mejorar búsquedas por tipo
CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);

-- =========================================
-- 2. TABLA: user_inventory
-- =========================================
-- Inventario personal de cada usuario

CREATE TABLE IF NOT EXISTS user_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  is_equipped BOOLEAN DEFAULT false,
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Un usuario no puede tener el mismo item duplicado
  UNIQUE(user_id, item_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_user_inventory_user ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_equipped ON user_inventory(user_id, is_equipped);

-- =========================================
-- 3. ACTUALIZAR TABLA: profiles
-- =========================================
-- Agregar columna para el marco activo

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS active_frame_key TEXT;

-- =========================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =========================================

-- Habilitar RLS en las nuevas tablas
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory ENABLE ROW LEVEL SECURITY;

-- Políticas para shop_items (lectura pública)
DROP POLICY IF EXISTS "shop_items_select_public" ON shop_items;
CREATE POLICY "shop_items_select_public"
  ON shop_items
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Políticas para user_inventory (cada usuario solo ve su inventario)
DROP POLICY IF EXISTS "user_inventory_select_own" ON user_inventory;
CREATE POLICY "user_inventory_select_own"
  ON user_inventory
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_inventory_insert_own" ON user_inventory;
CREATE POLICY "user_inventory_insert_own"
  ON user_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_inventory_update_own" ON user_inventory;
CREATE POLICY "user_inventory_update_own"
  ON user_inventory
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- =========================================
-- 5. DATOS DE EJEMPLO: Marcos de Perfil
-- =========================================

INSERT INTO shop_items (name, description, type, price_coins, image_url, frame_key)
VALUES
  (
    'Marco Dorado',
    'Un elegante marco con brillo dorado para destacar tu perfil',
    'profile_frame',
    50,
    '/frames/golden.png',
    'frame-golden'
  ),
  (
    'Marco Arcoíris',
    'Marco animado con colores vibrantes del arcoíris',
    'profile_frame',
    100,
    '/frames/rainbow.png',
    'frame-rainbow'
  ),
  (
    'Marco Diamante',
    'Marco premium con efecto de diamante brillante',
    'profile_frame',
    200,
    '/frames/diamond.png',
    'frame-diamond'
  ),
  (
    'Marco Fuego',
    'Marco con animación de llamas ardientes',
    'profile_frame',
    150,
    '/frames/fire.png',
    'frame-fire'
  ),
  (
    'Marco Neón',
    'Marco con luces de neón pulsantes',
    'profile_frame',
    120,
    '/frames/neon.png',
    'frame-neon'
  )
ON CONFLICT (frame_key) DO NOTHING;

-- =========================================
-- 6. FUNCIÓN HELPER: Equipar Marco
-- =========================================
-- Esta función se puede llamar desde el backend para equipar un marco de forma atómica

CREATE OR REPLACE FUNCTION equip_user_frame(
  p_user_id UUID,
  p_item_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_frame_key TEXT;
  v_owns_item BOOLEAN;
BEGIN
  -- Verificar que el usuario posee el item
  SELECT EXISTS(
    SELECT 1 FROM user_inventory 
    WHERE user_id = p_user_id AND item_id = p_item_id
  ) INTO v_owns_item;
  
  IF NOT v_owns_item THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No posees este artículo'
    );
  END IF;
  
  -- Obtener el frame_key del item
  SELECT frame_key INTO v_frame_key
  FROM shop_items
  WHERE id = p_item_id;
  
  -- Desequipar todos los marcos del usuario
  UPDATE user_inventory
  SET is_equipped = false
  WHERE user_id = p_user_id;
  
  -- Equipar el marco seleccionado
  UPDATE user_inventory
  SET is_equipped = true
  WHERE user_id = p_user_id AND item_id = p_item_id;
  
  -- Actualizar el perfil con el frame_key
  UPDATE profiles
  SET active_frame_key = v_frame_key
  WHERE id = p_user_id;
  
  RETURN json_build_object(
    'success', true,
    'frame_key', v_frame_key
  );
END;
$$;

-- =========================================
-- 7. VERIFICACIÓN
-- =========================================
-- Ejecuta estas consultas para verificar que todo se creó correctamente

-- Ver todos los artículos disponibles
-- SELECT * FROM shop_items WHERE is_active = true;

-- Ver el inventario de un usuario (reemplaza con tu user_id)
-- SELECT ui.*, si.name, si.frame_key 
-- FROM user_inventory ui
-- JOIN shop_items si ON ui.item_id = si.id
-- WHERE ui.user_id = 'tu-user-id';
