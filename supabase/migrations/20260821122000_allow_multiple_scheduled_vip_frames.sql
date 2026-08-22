-- El sistema anterior permitía un único registro habilitado. La agenda permite
-- varios registros futuros; la exclusión temporal evita únicamente solapamientos.
drop index if exists public.vip_exclusive_frames_active_unique;
