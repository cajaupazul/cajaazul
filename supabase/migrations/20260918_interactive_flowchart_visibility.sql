-- Migration to add interactive_flowchart_visible flag to platform_settings
alter table public.platform_settings 
add column if not exists interactive_flowchart_visible boolean not null default true;
