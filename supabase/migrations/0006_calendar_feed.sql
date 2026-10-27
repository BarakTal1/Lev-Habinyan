-- A secret link lets Google Calendar read the dates without a sign-in.
-- The link holds a random token. Founders create and revoke it in the app.
create table calendar_feed_token (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (token ~ '^[a-f0-9]{48}$'),
  created_by uuid references profile(id),
  created_at timestamptz not null default now()
);
alter table calendar_feed_token enable row level security;
create policy allowed_all on calendar_feed_token for all to authenticated using (is_allowed()) with check (is_allowed());

-- Returns the calendar dates when the token exists, otherwise null.
-- It returns titles, building names and dates only. No phone numbers, no notes, no costs.
create function calendar_feed(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from calendar_feed_token where token = p_token) then jsonb_build_object(
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'number', t.number, 'kind', t.kind, 'title', t.title, 'urgency', t.urgency, 'status', t.status,
        'created_at', t.created_at, 'due_at', t.due_at, 'scheduled_at', t.scheduled_at, 'building_name', b.name))
      from ticket t left join building b on b.id = t.building_id
      where t.archived_at is null and (b.id is null or b.archived_at is null) and (t.due_at is not null or t.scheduled_at is not null)
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'building_id', m.building_id, 'system', m.system, 'applicable', m.applicable,
        'next_due_at', m.next_due_at, 'building_name', b.name))
      from maintenance_item m join building b on b.id = m.building_id
      where m.archived_at is null and b.archived_at is null and m.next_due_at is not null
    ), '[]'::jsonb)
  ) else null end
$$;
revoke all on function calendar_feed(text) from public;
grant execute on function calendar_feed(text) to anon, authenticated;
