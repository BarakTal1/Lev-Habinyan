-- Only signed-in users whose email is in profile (the two founders and the developer) can read or write anything.

create function is_allowed() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profile where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create function current_profile_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from profile where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

do $$
declare t text;
begin
  foreach t in array array['profile','person','building','unit','unit_person','employee_profile','supplier_profile',
                           'maintenance_item','ticket','attachment','ticket_event','maintenance_log','setting'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy allowed_all on %I for all to authenticated using (is_allowed()) with check (is_allowed())', t);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function is_allowed(), current_profile_id() to authenticated;

-- Private bucket for photos, invoices and documents.
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', false) on conflict do nothing;
create policy attachments_allowed on storage.objects for all to authenticated
  using (bucket_id = 'attachments' and is_allowed()) with check (bucket_id = 'attachments' and is_allowed());
