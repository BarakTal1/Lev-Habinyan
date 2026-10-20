-- Track A schema. Delete is soft only (archived_at). Fixed lists are check constraints with the exact Hebrew values.

create table profile (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  person_id uuid,
  created_at timestamptz not null default now()
);

create table person (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  language text not null default 'he',
  role text not null check (role in ('founder','resident','committee','employee','supplier')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
alter table profile add constraint profile_person_fk foreign key (person_id) references person(id);

create table building (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table unit (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id),
  number text not null,
  archived_at timestamptz,
  unique (building_id, number)
);

create table unit_person (
  unit_id uuid not null references unit(id),
  person_id uuid not null references person(id),
  relation text not null check (relation in ('owner','tenant')),
  is_committee boolean not null default false,
  primary key (unit_id, person_id)
);

create table employee_profile (
  person_id uuid primary key references person(id),
  job_role text not null,
  area text
);

create table supplier_profile (
  person_id uuid primary key references person(id),
  category text not null,
  tier text not null check (tier in ('קבוע','דחוף','חירום')),
  availability text,
  area text,
  has_sla boolean not null default false,
  notes text
);

create table maintenance_item (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id),
  system text not null check (system in ('ניקיון','גינון','בדיקת מעלית','בדיקת כיבוי אש','הדברה','שעוני חשמל','בדיקת אינסטלציה','ניקוי פיר ביוב','בדיקת גג','משאבות','חיטוי מאגר מים','שער חניון')),
  applicable boolean not null default true,
  frequency_unit text check (frequency_unit in ('day','week','month','year')),
  frequency_count integer check (frequency_count > 0),
  frequency_note text,
  last_done_at date,
  next_due_at date,
  supplier_id uuid references person(id),
  notes text,
  archived_at timestamptz,
  unique (building_id, system)
);

create table ticket (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity,
  kind text not null check (kind in ('fault','task')),
  building_id uuid references building(id),
  unit_id uuid references unit(id),
  reporter_id uuid references person(id),
  category text not null check (category in ('חשמל','אינסטלציה','מעלית','ניקיון','גינון','תחזוקה כללית','הדברה','דלתות ושערים','פינוי פסולת','כיבוי אש','ביטוח','אינטרנט','אחר')),
  urgency text not null default 'חשוב' check (urgency in ('לא חשוב','חשוב','חשוב מאוד','דחוף','סכנה')),
  status text not null default 'חדש' check (status in ('חדש','הוקצה','בטיפול','ממתין','בוצע','נפתח מחדש','בוטל')),
  title text not null,
  description text,
  original_message text,
  assignee_id uuid references person(id),
  created_by uuid references profile(id),
  created_at timestamptz not null default now(),
  first_action_at timestamptz,
  due_at date,
  scheduled_at timestamptz,
  closed_at timestamptz,
  cost_amount numeric(12,2),
  maintenance_item_id uuid references maintenance_item(id),
  archived_at timestamptz
);
create index ticket_open_idx on ticket (status) where archived_at is null;

create table attachment (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references ticket(id),
  building_id uuid references building(id),
  kind text not null check (kind in ('photo','invoice','document')),
  storage_path text not null,
  mime_type text,
  created_by uuid references profile(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table ticket_event (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references ticket(id),
  type text not null check (type in ('created','status','assignment','note','photo','edit')),
  actor uuid references profile(id),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index ticket_event_ticket_idx on ticket_event (ticket_id, created_at);

create table maintenance_log (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references maintenance_item(id),
  done_at date not null,
  note text,
  attachment_id uuid references attachment(id),
  done_by uuid references profile(id),
  created_at timestamptz not null default now()
);

create table setting (
  key text primary key,
  value jsonb not null
);

-- First action: the first assignment or status change of a ticket.
create function ticket_first_action() returns trigger language plpgsql as $$
begin
  if new.first_action_at is null then
    if tg_op = 'INSERT' then
      if new.assignee_id is not null or new.status <> 'חדש' then new.first_action_at := now(); end if;
    elsif new.status is distinct from old.status or new.assignee_id is distinct from old.assignee_id then
      new.first_action_at := now();
    end if;
  end if;
  return new;
end $$;
create trigger ticket_first_action_trg before insert or update on ticket
  for each row execute function ticket_first_action();
