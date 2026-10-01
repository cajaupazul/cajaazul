revoke execute on function public.import_academic_offering_version(text, text, text, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.publish_academic_offering_version(uuid) from anon;
revoke execute on function public.delete_academic_offering_version(uuid) from anon;

grant execute on function public.import_academic_offering_version(text, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.publish_academic_offering_version(uuid) to authenticated;
grant execute on function public.delete_academic_offering_version(uuid) to authenticated;
