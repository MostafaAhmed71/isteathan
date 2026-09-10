-- Restore parent request time-window enforcement (Asia/Riyadh).
-- Primary (1–3): 11:10 – 12:30
-- Upper   (4–6): 11:40 – 12:30
-- Duty desk remains exempt via trg_permission_requests_time_window (017).

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
