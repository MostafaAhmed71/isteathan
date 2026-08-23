-- Secure RPCs for permission workflow

create or replace function public.create_permission_request(
  p_student_id uuid,
  p_reason text default null
)
returns public.permission_requests
language plpgsql
security definer
set search_path = public
as $$
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
$$;

create or replace function public.decide_permission_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.permission_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
  v_request public.permission_requests;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح';
  end if;

  if p_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'قرار غير صالح';
  end if;

  if p_decision = 'REJECTED' and (p_rejection_reason is null or length(trim(p_rejection_reason)) < 2) then
    raise exception 'سبب الرفض مطلوب';
  end if;

  v_class_id := public.staff_class_id();
  if v_class_id is null and not public.is_admin() then
    raise exception 'ليس لديك صلاحية على أي فصل';
  end if;

  select * into v_request
  from public.permission_requests
  where id = p_request_id
    and status = 'PENDING'
    and (class_id = v_class_id or public.is_admin())
  for update;

  if not found then
    raise exception 'الطلب غير موجود أو تمت معالجته';
  end if;

  update public.permission_requests
  set
    status = p_decision,
    rejection_reason = case when p_decision = 'REJECTED' then trim(p_rejection_reason) else null end,
    decided_at = now(),
    decided_by = auth.uid(),
    updated_at = now()
  where id = p_request_id
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.create_permission_request(uuid, text) from public;
revoke all on function public.decide_permission_request(uuid, text, text) from public;
grant execute on function public.create_permission_request(uuid, text) to authenticated;
grant execute on function public.decide_permission_request(uuid, text, text) to authenticated;
