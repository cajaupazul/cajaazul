ALTER TABLE vip_exclusive_frames
ADD COLUMN scale_factor numeric DEFAULT 1.4,
ADD COLUMN offset_x integer DEFAULT 0,
ADD COLUMN offset_y integer DEFAULT 0;
