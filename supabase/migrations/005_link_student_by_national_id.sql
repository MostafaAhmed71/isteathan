-- Allow students without guardian until a parent links by national ID.
alter table public.students
  alter column guardian_id drop not null;

create or replace function public.link_student_by_national_id(p_national_id text)
returns public.students
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_student public.students;
  v_nid text;
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

  v_nid := trim(p_national_id);
  if v_nid is null or length(v_nid) < 5 then
    raise exception 'رقم هوية الطالب غير صالح';
  end if;

  select * into v_student
  from public.students
  where national_id = v_nid
    and is_active = true
  for update;

  if not found then
    raise exception 'لا يوجد طالب بهذا الرقم. تأكد من رقم الهوية أو راجع إدارة المدرسة.';
  end if;

  if v_student.guardian_id is not null and v_student.guardian_id = auth.uid() then
    return v_student;
  end if;

  if v_student.guardian_id is not null and v_student.guardian_id <> auth.uid() then
    raise exception 'هذا الطالب مرتبط بولي أمر آخر. راجع إدارة المدرسة.';
  end if;

  update public.students
  set guardian_id = auth.uid(),
      updated_at = now()
  where id = v_student.id
  returning * into v_student;

  return v_student;
end;
$fn$;

revoke all on function public.link_student_by_national_id(text) from public;
grant execute on function public.link_student_by_national_id(text) to authenticated;
