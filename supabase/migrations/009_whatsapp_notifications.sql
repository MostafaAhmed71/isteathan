-- WhatsApp supervisor groups + idempotent notification log
-- Does not change permission_requests workflow.

create table if not exists public.supervisor_groups (
  id uuid primary key default gen_random_uuid(),
  group_key text not null unique check (group_key in ('GROUP_1_2_3', 'GROUP_4_5_6')),
  group_name text not null,
  supervisor_name text not null default '',
  whatsapp_number text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists supervisor_groups_updated_at on public.supervisor_groups;
create trigger supervisor_groups_updated_at
  before update on public.supervisor_groups
  for each row execute function public.set_updated_at();

insert into public.supervisor_groups (group_key, group_name, supervisor_name, whatsapp_number)
values
  ('GROUP_1_2_3', 'الصفوف الأول والثاني والثالث', '', ''),
  ('GROUP_4_5_6', 'الصفوف الرابع والخامس والسادس', '', '')
on conflict (group_key) do nothing;

create table if not exists public.whatsapp_notifications (
  id uuid primary key default gen_random_uuid(),
  permission_request_id uuid not null references public.permission_requests(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('SUPERVISOR', 'PARENT')),
  recipient_phone text not null default '',
  message_type text not null check (message_type in ('REQUEST_CREATED', 'REQUEST_APPROVED', 'REQUEST_REJECTED')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (permission_request_id, message_type, recipient_type)
);

create index if not exists idx_wa_notifications_request
  on public.whatsapp_notifications (permission_request_id);

alter table public.supervisor_groups enable row level security;
alter table public.whatsapp_notifications enable row level security;

drop policy if exists supervisor_groups_admin_all on public.supervisor_groups;
create policy supervisor_groups_admin_all on public.supervisor_groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists whatsapp_notifications_admin_select on public.whatsapp_notifications;
create policy whatsapp_notifications_admin_select on public.whatsapp_notifications
  for select to authenticated
  using (public.is_admin());
