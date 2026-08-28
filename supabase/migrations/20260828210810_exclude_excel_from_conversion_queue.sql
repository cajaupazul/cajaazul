-- Excel workbooks must remain editable and are never converted to PDF.
-- Cancel only work that has not completed; existing files and metadata remain intact.
update public.conversion_jobs
set status = 'cancelled',
    completed_at = now(),
    locked_at = null,
    locked_by = null,
    last_error = 'Excel files are preserved in their original format',
    updated_at = now()
where status in ('pending', 'processing')
  and source_key ~* '\.xlsx?$';
