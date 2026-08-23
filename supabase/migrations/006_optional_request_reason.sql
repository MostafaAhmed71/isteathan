-- Make permission request reason optional
create or replace function public.create_permission_request(
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
  if auth.uid() is null then
    raise exception 'غير مصرح';
  end if;

  v_reason := coalesce(trim(p_reason), '');

  select * into v_student
  from public.students
  where id = p_student_id
    and guardian_id = auth.uid()
    and is_active = true;

  if not found then
    raise exception 'الطالب غير موجود أو غير مرتبط بحسابك';
  end if;

  if exists (
    select 1 from public.permission_requests
    where student_id = p_student_id and status = 'PENDING'
  ) then
    raise exception 'يوجد بالفعل طلب استئذان قيد الانتظار لهذا الطالب.';
  end if;

  insert into public.permission_requests (
    student_id, guardian_id, class_id, reason, status
  ) values (
    v_student.id, auth.uid(), v_student.class_id, v_reason, 'PENDING'
  )
  returning * into v_request;

  return v_request;
end;
$fn$;

revoke all on function public.create_permission_request(uuid, text) from public;
grant execute on function public.create_permission_request(uuid, text) to authenticated;
