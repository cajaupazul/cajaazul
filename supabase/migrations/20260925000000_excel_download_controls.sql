-- Limit the platform download switch to Excel workbooks. Existing installations
-- inherit the previous global setting once; subsequent runs do not reset it.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_settings'
      and column_name = 'excel_downloads_enabled'
  ) then
    alter table public.platform_settings
      add column excel_downloads_enabled boolean not null default true;

    update public.platform_settings
    set excel_downloads_enabled = downloads_enabled
    where id = true;
  end if;
end;
$$;

comment on column public.platform_settings.excel_downloads_enabled is
  'Controls explicit .xls/.xlsx downloads for non-VIP, non-admin users.';
