-- ============================================
-- Schedule Builder: oferta_academica + user_schedules
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. Tabla principal: Oferta Académica (datos parseados del PDF)
CREATE TABLE IF NOT EXISTS public.oferta_academica (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  periodo text NOT NULL,                    -- ej: "2026-I PERIODO-PRE"
  codigo_curso text NOT NULL,               -- ej: "120266"
  nombre_curso text NOT NULL,               -- ej: "Antiguo Perú, Arqueología..."
  seccion text NOT NULL DEFAULT 'A',        -- ej: "A", "B"
  profesor text,                            -- nombre del docente
  creditos numeric DEFAULT 0,
  tipo text DEFAULT 'CLASE',                -- CLASE, FINAL, PARCIAL
  dia text NOT NULL,                        -- LUN, MAR, MIE, JUE, VIE, SAB, DOM
  hora_inicio time NOT NULL,
  hora_fin time NOT NULL,
  duracion integer DEFAULT 0,               -- minutos
  cupos integer DEFAULT 0,
  aula text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Tabla de horarios guardados por usuarios
CREATE TABLE IF NOT EXISTS public.user_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  periodo text NOT NULL,
  nombre text NOT NULL DEFAULT 'Horario 1',
  secciones jsonb DEFAULT '[]'::jsonb,      -- array de IDs de oferta_academica
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_oferta_periodo ON public.oferta_academica(periodo);
CREATE INDEX IF NOT EXISTS idx_oferta_codigo ON public.oferta_academica(codigo_curso);
CREATE INDEX IF NOT EXISTS idx_oferta_nombre ON public.oferta_academica(nombre_curso);
CREATE INDEX IF NOT EXISTS idx_user_schedules_user ON public.user_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_user_schedules_periodo ON public.user_schedules(periodo);

-- 4. RLS Policies
ALTER TABLE public.oferta_academica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_schedules ENABLE ROW LEVEL SECURITY;

-- oferta_academica: todos los autenticados pueden leer
CREATE POLICY "oferta_academica_select" ON public.oferta_academica
  FOR SELECT TO authenticated USING (true);

-- oferta_academica: solo admin/superadmin pueden insertar
CREATE POLICY "oferta_academica_insert" ON public.oferta_academica
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- oferta_academica: solo admin/superadmin pueden eliminar
CREATE POLICY "oferta_academica_delete" ON public.oferta_academica
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );

-- user_schedules: usuarios solo ven sus propios horarios
CREATE POLICY "user_schedules_select" ON public.user_schedules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- user_schedules: usuarios solo crean sus propios horarios
CREATE POLICY "user_schedules_insert" ON public.user_schedules
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- user_schedules: usuarios solo editan sus propios horarios
CREATE POLICY "user_schedules_update" ON public.user_schedules
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- user_schedules: usuarios solo eliminan sus propios horarios
CREATE POLICY "user_schedules_delete" ON public.user_schedules
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
