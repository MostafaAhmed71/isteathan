-- Primary grades: supervisor per class, not per grade.
-- Safe to run even if 010 already created GRADE_1 / GRADE_2 / GRADE_3.

create table if not exists public.supervisor_class_contacts (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes(id) on delete cascade,
  supervisor_name text not null default '',
  whatsapp_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists supervisor_class_contacts_updated_at on public.supervisor_class_contacts;
create trigger supervisor_class_contacts_updated_at
  before update on public.supervisor_class_contacts
  for each row execute function public.set_updated_at();

insert into public.supervisor_class_contacts (class_id)
select id from public.classes
where grade in (1, 2, 3)
on conflict (class_id) do nothing;

alter table public.supervisor_class_contacts enable row level security;

drop policy if exists supervisor_class_contacts_admin_all on public.supervisor_class_contacts;
create policy supervisor_class_contacts_admin_all on public.supervisor_class_contacts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

delete from public.supervisor_groups
where group_key in ('GRADE_1', 'GRADE_2', 'GRADE_3');
