begin;

create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
set search_path = pg_catalog, auth, public, private
as $$
declare
  target_user_id uuid := auth.uid();
begin
  if target_user_id is null then
    raise exception using errcode = '42501', message = 'No autenticado.';
  end if;

  delete from public.profiles where id = target_user_id;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated, service_role;

commit;
