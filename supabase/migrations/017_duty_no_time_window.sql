-- Duty desk may create exit requests any time (no school window).

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

  -- No time-window check for duty desk.

  if exists (
    select 1 from public.permission_requests
    where student_id = p_student_id and status = 'PENDING'
  ) then
    raise exception 'يوجد بالفعل طلب خروج قيد الانتظار لهذا الطالب.';
  end if;

  insert into public.permission_requests (
    student_id, guardian_id, class_id, reason, status
  ) values (
    v_student.id,
    v_student.guardian_id,
    v_student.class_id,
    v_reason,
    'PENDING'
  )
  returning * into v_request;

  return v_request;
end;
$fn$;

create or replace function public.trg_permission_requests_time_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_grade integer;
begin
  -- Seed / service role, and duty/admin desk: no window.
  if auth.uid() is null or public.is_duty_or_admin() then
    return NEW;
  end if;

  select grade into v_grade
  from public.students
  where id = NEW.student_id;

  if v_grade is null then
    raise exception 'الطالب غير موجود.';
  end if;

  perform public.assert_permission_request_window(v_grade);
  return NEW;
end;
$fn$;

revoke all on function public.create_duty_permission_request(uuid, text) from public;
grant execute on function public.create_duty_permission_request(uuid, text) to authenticated;
