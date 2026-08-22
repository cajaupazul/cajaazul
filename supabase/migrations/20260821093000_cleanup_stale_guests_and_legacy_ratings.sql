-- Keep production analytics and Auth user counts clean without removing the
-- anonymous guest mode used by the landing page.
--
-- Supabase does not automatically purge anonymous users. Guests older than
-- 30 days are removed only when they have no recent activity and no business
-- data associated with their account.

delete from auth.users as guest
where guest.is_anonymous is true
  and guest.created_at < now() - interval '30 days'
  and not exists (
    select 1
    from public.profiles as profile
    where profile.id = guest.id
      and profile.last_seen >= now() - interval '30 days'
  )
  and not exists (select 1 from public.materials where user_id = guest.id)
  and not exists (select 1 from public.professor_ratings where user_id = guest.id)
  and not exists (select 1 from public.professor_comments where user_id = guest.id)
  and not exists (select 1 from public.professor_comment_reactions where user_id = guest.id)
  and not exists (select 1 from public.posts where user_id = guest.id)
  and not exists (select 1 from public.comments where user_id = guest.id)
  and not exists (select 1 from public.likes where user_id = guest.id)
  and not exists (select 1 from public.payment_orders where user_id = guest.id)
  and not exists (select 1 from public.transacciones_tienda where user_id = guest.id)
  and not exists (select 1 from public.user_inventory where user_id = guest.id)
  and not exists (select 1 from public.student_course_progress where user_id = guest.id)
  and not exists (select 1 from public.user_schedules where user_id = guest.id)
  and not exists (select 1 from public.user_professors where user_id = guest.id)
  and not exists (select 1 from public.grupo_miembros where user_id = guest.id)
  and not exists (select 1 from public.grupos where created_by = guest.id)
  and not exists (select 1 from public.user_flowchart_drawings where user_id = guest.id)
  and not exists (select 1 from public.user_decorations where placer_id = guest.id)
  and not exists (select 1 from public.pixel_templates where user_id = guest.id)
  and not exists (select 1 from public.pixel_history where user_id = guest.id)
  and not exists (select 1 from public.pixel_group_templates where owner_id = guest.id);

-- This empty legacy table was superseded by professor_ratings. It has no
-- runtime callers, views, or database functions depending on it.
drop table if exists public.ratings;
