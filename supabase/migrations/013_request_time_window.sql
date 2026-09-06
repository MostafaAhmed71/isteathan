-- Restrict parent permission requests by school time window (Asia/Riyadh).
-- Primary (1–3): 11:10 – 12:30
-- Upper   (4–6): 11:40 – 12:30
--
-- IMPORTANT: Run this entire file in Supabase Dashboard → SQL Editor → Run.

create or replace function public.permission_request_opens_at(p_grade integer)
returns time
language sql
immutable
as $$
  select case
    when p_grade between 1 and 3 then time '11:10'
    when p_grade between 4 and 6 then time '11:40'
    else null
  end;
$$;

create or replace function public.permission_request_closes_at()
returns time
language sql
immutable
as $$
  select time '12:30';
$$;

create or replace function public.assert_permission_request_window(p_grade integer)
returns void
language plpgsql
stable
as $fn$
declare
  v_opens_at time;
  v_closes_at time;
  v_now_local time;
  v_band text;
  v_window text;
begin
  v_opens_at := public.permission_request_opens_at(p_grade);
  v_closes_at := public.permission_request_closes_at();
  if v_opens_at is null then
    raise exception 'صف الطالب غير صالح لإرسال الطلب.';
  end if;

  if p_grade <= 3 then
    v_band := 'الأولية';
    v_window := '11:10 ص حتى 12:30 م';
  else
    v_band := 'العليا';
    v_window := '11:40 ص حتى 12:30 م';
  end if;

  v_now_local := (timezone('Asia/Riyadh', now()))::time;

  if v_now_local >= v_opens_at and v_now_local < v_closes_at then
    return;
  end if;

  if v_now_local < v_opens_at then
    raise exception
      using message = format(
        'لم يحن وقت تقديم الطلبات بعد. تقديم طلبات الصفوف %s متاح من %s (توقيت الرياض).',
        v_band,
        v_window
      );
  end if;

  raise exception
    using message = format(
      'انتهى وقت تقديم الطلبات. تقديم طلبات الصفوف %s متاح من %s (توقيت الرياض).',
      v_band,
      v_window
    );
end;
$fn$;

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

  perform public.assert_permission_request_window(v_student.grade);

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

-- Extra safety for parent inserts. Service-role / seed (auth.uid() null) allowed.
create or replace function public.trg_permission_requests_time_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_grade integer;
begin
  if auth.uid() is null then
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

drop trigger if exists permission_requests_time_window on public.permission_requests;
create trigger permission_requests_time_window
before insert on public.permission_requests
for each row
execute function public.trg_permission_requests_time_window();

revoke all on function public.create_permission_request(uuid, text) from public;
grant execute on function public.create_permission_request(uuid, text) to authenticated;

revoke all on function public.permission_request_opens_at(integer) from public;
grant execute on function public.permission_request_opens_at(integer) to authenticated;

revoke all on function public.permission_request_closes_at() from public;
grant execute on function public.permission_request_closes_at() to authenticated;

revoke all on function public.assert_permission_request_window(integer) from public;
grant execute on function public.assert_permission_request_window(integer) to authenticated;
