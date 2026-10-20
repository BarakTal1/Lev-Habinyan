-- Which reminders were already emailed, so a daily job never sends the same one twice.
create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references maintenance_item(id),
  kind text not null check (kind in ('before14','due')),
  due_date date not null,
  sent_at timestamptz not null default now(),
  unique (item_id, kind, due_date)
);
alter table reminder_log enable row level security;
create policy allowed_all on reminder_log for all to authenticated using (is_allowed()) with check (is_allowed());
grant select, insert on reminder_log to authenticated;
