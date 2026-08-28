-- Durable document conversion queue for the Render worker (applied 2026-08-27).
-- The queue is private to service_role; browser clients never read or mutate it.

create extension if not exists pg_net;

alter table public.materials
    add column if not exists storage_path text;

comment on column public.materials.storage_path is
    'Canonical R2 object key. Used for exact, idempotent conversion updates.';

-- Best-effort backfill for legacy secure URLs. New writes always set the raw key.
update public.materials
set storage_path = replace(
    replace(substring(url_archivo from '[?&]path=([^&]+)'), '%2F', '/'),
    '%20',
    ' '
)
where storage_path is null
  and url_archivo ~ '[?&]path=';

create index if not exists materials_storage_path_idx
    on public.materials (storage_path)
    where storage_path is not null;

create table if not exists public.conversion_jobs (
    id uuid primary key default gen_random_uuid(),
    bucket text not null default 'course-materials',
    source_key text not null,
    source_size_bytes bigint,
    requested_by uuid references auth.users(id) on delete set null,
    status text not null default 'pending'
        check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority smallint not null default 0,
    attempts smallint not null default 0 check (attempts >= 0),
    max_attempts smallint not null default 3 check (max_attempts between 1 and 5),
    available_at timestamptz not null default now(),
    locked_at timestamptz,
    locked_by text,
    started_at timestamptz,
    completed_at timestamptz,
    last_error text,
    result jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint conversion_jobs_bucket_check check (bucket = 'course-materials'),
    constraint conversion_jobs_source_key_check check (
        length(source_key) between 1 and 1024
        and source_key !~ '(^/|\\\\|(^|/)\.\.(/|$)|[[:cntrl:]])'
    )
);

comment on table public.conversion_jobs is
    'Persistent, retryable queue consumed sequentially by campuslink-converter.';

alter table public.conversion_jobs enable row level security;
revoke all on table public.conversion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.conversion_jobs to service_role;

create unique index if not exists conversion_jobs_one_active_source_idx
    on public.conversion_jobs (bucket, source_key)
    where status in ('pending', 'processing');

create index if not exists conversion_jobs_pending_claim_idx
    on public.conversion_jobs (priority desc, available_at, created_at)
    where status = 'pending';

create index if not exists conversion_jobs_stale_lock_idx
    on public.conversion_jobs (locked_at)
    where status = 'processing';

create index if not exists conversion_jobs_retention_idx
    on public.conversion_jobs (completed_at)
    where status in ('completed', 'failed', 'cancelled');

create or replace function public.claim_conversion_job(
    p_worker_id text,
    p_stale_after interval default interval '20 minutes'
)
returns setof public.conversion_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if nullif(btrim(p_worker_id), '') is null then
        raise exception 'worker id is required';
    end if;

    -- A worker can disappear during a Render restart. Exhausted stale jobs are
    -- finalized; retryable stale jobs are eligible for the atomic claim below.
    update public.conversion_jobs
    set status = 'failed',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        last_error = coalesce(last_error, 'Worker stopped before completing the job'),
        updated_at = now()
    where status = 'processing'
      and locked_at < now() - p_stale_after
      and attempts >= max_attempts;

    return query
    with candidate as (
        select job.id
        from public.conversion_jobs as job
        where (
            (job.status = 'pending' and job.available_at <= now())
            or
            (job.status = 'processing' and job.locked_at < now() - p_stale_after)
        )
          and job.attempts < job.max_attempts
        order by job.priority desc, job.available_at, job.created_at
        for update skip locked
        limit 1
    )
    update public.conversion_jobs as job
    set status = 'processing',
        attempts = job.attempts + 1,
        locked_at = now(),
        locked_by = p_worker_id,
        started_at = coalesce(job.started_at, now()),
        completed_at = null,
        updated_at = now()
    from candidate
    where job.id = candidate.id
    returning job.*;
end;
$$;

create or replace function public.complete_conversion_job(
    p_job_id uuid,
    p_worker_id text,
    p_result jsonb default '{}'::jsonb
)
returns setof public.conversion_jobs
language sql
security invoker
set search_path = ''
as $$
    update public.conversion_jobs
    set status = 'completed',
        result = coalesce(p_result, '{}'::jsonb),
        last_error = null,
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = p_job_id
      and status = 'processing'
      and locked_by = p_worker_id
    returning *;
$$;

create or replace function public.fail_conversion_job(
    p_job_id uuid,
    p_worker_id text,
    p_error text
)
returns setof public.conversion_jobs
language sql
security invoker
set search_path = ''
as $$
    update public.conversion_jobs
    set status = case when attempts >= max_attempts then 'failed' else 'pending' end,
        available_at = case
            when attempts >= max_attempts then available_at
            else now() + make_interval(secs => least(900, (30 * power(2, greatest(attempts - 1, 0)))::integer))
        end,
        completed_at = case when attempts >= max_attempts then now() else null end,
        last_error = left(coalesce(nullif(p_error, ''), 'Unknown conversion error'), 4000),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where id = p_job_id
      and status = 'processing'
      and locked_by = p_worker_id
    returning *;
$$;

create or replace function public.cancel_conversion_jobs(
    p_bucket text,
    p_source_key text,
    p_reason text default 'Source object deleted'
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
    affected bigint;
begin
    update public.conversion_jobs
    set status = 'cancelled',
        completed_at = now(),
        last_error = left(coalesce(p_reason, 'Source object deleted'), 4000),
        locked_at = null,
        locked_by = null,
        updated_at = now()
    where bucket = p_bucket
      and source_key = p_source_key
      and status in ('pending', 'processing');

    get diagnostics affected = row_count;
    return affected;
end;
$$;

create or replace function public.cleanup_conversion_jobs()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
    affected bigint;
begin
    delete from public.conversion_jobs
    where (status = 'completed' and completed_at < now() - interval '7 days')
       or (status in ('failed', 'cancelled') and completed_at < now() - interval '30 days');

    get diagnostics affected = row_count;
    return affected;
end;
$$;

create or replace function public.dispatch_pending_conversions()
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
    request_id bigint;
begin
    if not exists (
        select 1
        from public.conversion_jobs
        where (status = 'pending' and available_at <= now())
           or (status = 'processing' and locked_at < now() - interval '20 minutes')
    ) then
        return null;
    end if;

    select net.http_post(
        url := 'https://campuslink-converter.onrender.com/drain',
        body := jsonb_build_object('source', 'supabase-cron'),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 10000
    ) into request_id;

    return request_id;
end;
$$;

revoke all on function public.claim_conversion_job(text, interval) from public, anon, authenticated;
revoke all on function public.complete_conversion_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_conversion_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_conversion_jobs(text, text, text) from public, anon, authenticated;
revoke all on function public.cleanup_conversion_jobs() from public, anon, authenticated;
revoke all on function public.dispatch_pending_conversions() from public, anon, authenticated;

grant execute on function public.claim_conversion_job(text, interval) to service_role;
grant execute on function public.complete_conversion_job(uuid, text, jsonb) to service_role;
grant execute on function public.fail_conversion_job(uuid, text, text) to service_role;
grant execute on function public.cancel_conversion_jobs(text, text, text) to service_role;
grant execute on function public.cleanup_conversion_jobs() to service_role;
grant execute on function public.dispatch_pending_conversions() to service_role;

do $$
declare
    existing_job_id bigint;
begin
    for existing_job_id in
        select jobid from cron.job
        where jobname in ('dispatch-pending-conversions', 'cleanup-conversion-jobs')
    loop
        perform cron.unschedule(existing_job_id);
    end loop;
end;
$$;

select cron.schedule(
    'dispatch-pending-conversions',
    '* * * * *',
    $cron$select public.dispatch_pending_conversions();$cron$
);

select cron.schedule(
    'cleanup-conversion-jobs',
    '17 3 * * *',
    $cron$select public.cleanup_conversion_jobs();$cron$
);
