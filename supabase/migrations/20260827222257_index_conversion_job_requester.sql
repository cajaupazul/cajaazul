-- Avoid full queue scans when an auth user is deleted and requested_by is nulled.
create index if not exists conversion_jobs_requested_by_idx
    on public.conversion_jobs (requested_by)
    where requested_by is not null;
