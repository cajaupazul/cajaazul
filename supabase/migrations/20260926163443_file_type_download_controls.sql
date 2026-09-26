-- Independent explicit-download controls for each supported file family.
-- Existing Excel behavior is preserved; all newly separated families remain
-- enabled initially because they were downloadable before this migration.

alter table public.platform_settings
  add column if not exists pdf_downloads_enabled boolean not null default true,
  add column if not exists powerpoint_downloads_enabled boolean not null default true,
  add column if not exists word_downloads_enabled boolean not null default true,
  add column if not exists image_downloads_enabled boolean not null default true,
  add column if not exists archive_downloads_enabled boolean not null default true,
  add column if not exists other_downloads_enabled boolean not null default true;

comment on column public.platform_settings.pdf_downloads_enabled is
  'Controls explicit PDF downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.excel_downloads_enabled is
  'Controls explicit spreadsheet downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.powerpoint_downloads_enabled is
  'Controls explicit presentation downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.word_downloads_enabled is
  'Controls explicit text-document downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.image_downloads_enabled is
  'Controls explicit image downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.archive_downloads_enabled is
  'Controls explicit compressed-file downloads for non-VIP, non-admin users.';
comment on column public.platform_settings.other_downloads_enabled is
  'Controls explicit downloads of unclassified files for non-VIP, non-admin users.';
