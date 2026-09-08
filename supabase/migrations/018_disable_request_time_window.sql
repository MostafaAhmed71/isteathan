-- TEMPORARY: disable parent request time-window enforcement.
-- Re-enable later by restoring assert_permission_request_window from 013_request_time_window.sql

create or replace function public.assert_permission_request_window(p_grade integer)
returns void
language plpgsql
stable
as $fn$
begin
  -- Time window temporarily disabled.
  if p_grade is null or p_grade < 1 or p_grade > 6 then
    raise exception 'صف الطالب غير صالح لإرسال الطلب.';
  end if;
  return;
end;
$fn$;
