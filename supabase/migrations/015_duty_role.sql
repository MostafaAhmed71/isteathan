-- Duty officer role (مناوب) — separate login from ADMIN.

-- Expand profiles.role check to include DUTY
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles drop constraint if exists profiles_identifier_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('PARENT', 'CLASS_STAFF', 'ADMIN', 'DUTY'));

alter table public.profiles
  add constraint profiles_identifier_check
  check (
    (role = 'PARENT' and national_id is not null)
    or (role = 'CLASS_STAFF' and username is not null)
    or (role = 'ADMIN')
    or (role = 'DUTY' and username is not null)
  );

create or replace function public.is_duty()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'DUTY' and is_active = true
  );
$$;

create or replace function public.is_duty_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_duty();
$$;

-- Duty can list all active students + classes (search desk)
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated
  using (
    guardian_id = auth.uid()
    or public.is_admin()
    or public.is_duty()
    or class_id = public.staff_class_id()
  );

drop policy if exists classes_select_authenticated on public.classes;
create policy classes_select_authenticated on public.classes
  for select to authenticated
  using (
    public.is_admin()
    or public.is_duty()
    or staff_profile_id = auth.uid()
    or exists (
      select 1 from public.students s
      where s.class_id = classes.id and s.guardian_id = auth.uid()
    )
  );

-- Duty may see requests they created / all pending for awareness (read)
drop policy if exists requests_select on public.permission_requests;
create policy requests_select on public.permission_requests
  for select to authenticated
  using (
    guardian_id = auth.uid()
    or class_id = public.staff_class_id()
    or public.is_admin()
    or public.is_duty()
  );

-- RPC: ADMIN or DUTY
create or replace function public.create_duty_permission_request(
  p_student_id uuid,
  p_reason text default null
)
returns public.permission_requests
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_student public.students;
  v_request public.permission_requests;
  v_reason text;
  v_guardian uuid;
begin
  if auth.uid() is null or not public.is_duty_or_admin() then
    raise exception 'غير مصرح. هذه الشاشة لحساب المناوب فقط.';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), 'طلب خروج من المناوب');

  select * into v_student
  from public.students
  where id = p_student_id
    and is_active = true;

  if not found then
    raise exception 'الطالب غير موجود أو غير نشط.';
  end if;

  if v_student.class_id is null then
    raise exception 'الطالب غير مرتبط بفصل.';
  end if;

  v_guardian := v_student.guardian_id;
  if v_guardian is null then
    raise exception 'الطالب غير مرتبط بولي أمر. اربط ولي الأمر أولاً ثم أعد المحاولة.';
  end if;

  perform public.assert_permission_request_window(v_student.grade);

  if exists (
    select 1 from public.permission_requests
    where student_id = p_student_id and status = 'PENDING'
  ) then
    raise exception 'يوجد بالفعل طلب خروج قيد الانتظار لهذا الطالب.';
  end if;

  insert into public.permission_requests (
    student_id, guardian_id, class_id, reason, status
  ) values (
    v_student.id, v_guardian, v_student.class_id, v_reason, 'PENDING'
  )
  returning * into v_request;

  return v_request;
end;
$fn$;

revoke all on function public.is_duty() from public;
grant execute on function public.is_duty() to authenticated;

revoke all on function public.is_duty_or_admin() from public;
grant execute on function public.is_duty_or_admin() to authenticated;

revoke all on function public.create_duty_permission_request(uuid, text) from public;
grant execute on function public.create_duty_permission_request(uuid, text) to authenticated;
