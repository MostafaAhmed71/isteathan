-- Grades 1–3: one supervisor per class (section).
-- Grades 4–6: one supervisor per grade per weekday (Asia/Riyadh).

alter table public.supervisor_groups drop constraint if exists supervisor_groups_group_key_check;

delete from public.supervisor_groups
where group_key in ('GROUP_1_2_3', 'GROUP_4_5_6', 'GRADE_1', 'GRADE_2', 'GRADE_3');

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

create table if not exists public.supervisor_daily_roster (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade in (4, 5, 6)),
  weekday smallint not null check (weekday between 0 and 6),
  supervisor_name text not null default '',
  whatsapp_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grade, weekday)
);

drop trigger if exists supervisor_daily_roster_updated_at on public.supervisor_daily_roster;
create trigger supervisor_daily_roster_updated_at
  before update on public.supervisor_daily_roster
  for each row execute function public.set_updated_at();

insert into public.supervisor_daily_roster (grade, weekday)
select g.grade, d.weekday
from (values (4), (5), (6)) as g(grade)
cross join (values (0), (1), (2), (3), (4), (5), (6)) as d(weekday)
on conflict (grade, weekday) do nothing;

alter table public.supervisor_daily_roster enable row level security;

drop policy if exists supervisor_daily_roster_admin_all on public.supervisor_daily_roster;
create policy supervisor_daily_roster_admin_all on public.supervisor_daily_roster
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
