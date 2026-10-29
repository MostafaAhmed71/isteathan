-- Parent can unlink a child they currently guard (sets guardian_id to null).
create or replace function public.unlink_student(p_student_id uuid)
returns public.students
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_student public.students;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'PARENT' and is_active = true
  ) then
    raise exception 'هذه العملية لأولياء الأمور فقط';
  end if;

  select * into v_student
  from public.students
  where id = p_student_id
    and is_active = true
  for update;

  if not found then
    raise exception 'الطالب غير موجود';
  end if;

  if v_student.guardian_id is distinct from auth.uid() then
    raise exception 'هذا الطالب غير مرتبط بحسابك';
  end if;

  update public.permission_requests
  set status = 'CANCELLED',
      updated_at = now()
  where student_id = v_student.id
    and guardian_id = auth.uid()
    and status = 'PENDING';

  update public.students
  set guardian_id = null,
      updated_at = now()
  where id = v_student.id
  returning * into v_student;

  return v_student;
end;
$fn$;

revoke all on function public.unlink_student(uuid) from public;
grant execute on function public.unlink_student(uuid) to authenticated;
