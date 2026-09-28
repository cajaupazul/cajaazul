-- Distinguish intentionally classified historical evaluations from legacy
-- records that simply do not have a cycle.
alter table public.materials
    add column if not exists material_scope text not null default 'standard',
    add column if not exists evaluation_type text,
    add column if not exists academic_period text;

alter table public.materials
    drop constraint if exists materials_material_scope_check,
    add constraint materials_material_scope_check
        check (material_scope in ('standard', 'course_bank')),
    drop constraint if exists materials_evaluation_type_check,
    add constraint materials_evaluation_type_check
        check (
            evaluation_type is null
            or evaluation_type in ('pc1', 'pc2', 'pc3', 'pc4', 'pc5', 'midterm', 'final', 'makeup', 'other')
        ),
    drop constraint if exists materials_academic_period_check,
    add constraint materials_academic_period_check
        check (
            academic_period is null
            or academic_period ~ '^(19|20)[0-9]{2}-(0|1|2)$'
        ),
    drop constraint if exists materials_course_bank_classification_check,
    add constraint materials_course_bank_classification_check
        check (
            material_scope <> 'course_bank'
            or (
                cycle_id is null
                and evaluation_type is not null
                and academic_period is not null
            )
        );

create index if not exists materials_course_bank_lookup_idx
    on public.materials (course_id, evaluation_type, academic_period desc)
    where material_scope = 'course_bank';

comment on column public.materials.material_scope is
    'standard: material tied to a cycle/shared section; course_bank: classified historical evaluation visible across cycles.';
comment on column public.materials.evaluation_type is
    'Normalized evaluation kind: pc1..pc5, midterm, final, makeup or other.';
comment on column public.materials.academic_period is
    'Original academic period normalized as YYYY-0, YYYY-1 or YYYY-2.';
