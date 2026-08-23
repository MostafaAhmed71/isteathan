-- Ensure parents receive full UPDATE payloads on permission_requests (for decision alerts).
alter table public.permission_requests replica identity full;
