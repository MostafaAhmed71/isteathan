-- Tighten profile self-registration: only PARENT may insert own row.
-- Admin inserts via service role / edge function.

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_self_parent_or_admin on public.profiles
  for insert to authenticated
  with check (
    public.is_admin()
    or (id = auth.uid() and role = 'PARENT')
  );

-- One-time bootstrap: create ADMIN profile for current auth user if no admin exists.
create or replace function public.bootstrap_admin_profile(p_full_name text default 'مدير النظام')
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح';
  end if;

  if exists (select 1 from public.profiles where role = 'ADMIN') then
    raise exception 'يوجد مدير مسبقًا';
  end if;

  insert into public.profiles (id, full_name, role, username, national_id, phone, is_active)
  values (auth.uid(), coalesce(nullif(trim(p_full_name), ''), 'مدير النظام'), 'ADMIN', 'admin', null, null, true)
  on conflict (id) do update
    set role = 'ADMIN',
        full_name = excluded.full_name,
        username = 'admin',
        is_active = true
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.bootstrap_admin_profile(text) from public;
grant execute on function public.bootstrap_admin_profile(text) to authenticated;
