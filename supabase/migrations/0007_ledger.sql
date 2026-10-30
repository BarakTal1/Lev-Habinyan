-- Payments ledger. The app records charges and payments and computes balances. It never collects money.
-- Amounts are whole agorot. Delete is soft only (archived_at).

alter table unit add column floor text;
alter table unit add column payer text check (payer in ('owner','tenant'));

-- The monthly fee of one apartment for one month. The month is its first day.
create table tariff (
  unit_id uuid not null references unit(id),
  month date not null check (extract(day from month) = 1),
  amount_agorot integer not null check (amount_agorot >= 0),
  primary key (unit_id, month)
);

-- A one-time charge for a building, split into one line for each apartment that pays it.
create table special_charge (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id),
  name text not null,
  due_date date not null,
  created_by uuid references profile(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table special_charge_line (
  special_charge_id uuid not null references special_charge(id),
  unit_id uuid not null references unit(id),
  amount_agorot integer not null check (amount_agorot > 0),
  primary key (special_charge_id, unit_id)
);

create table import_batch (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('tariffs','payments')),
  file_name text not null,
  uploaded_by uuid references profile(id),
  summary jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- One money movement. unit_id null means the payment is not yet linked to an apartment.
-- A negative amount is a refund. external_id makes imports and provider pulls idempotent.
create table payment (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references building(id),
  unit_id uuid references unit(id),
  month date check (month is null or extract(day from month) = 1),
  amount_agorot integer not null check (amount_agorot <> 0),
  paid_at date not null,
  method text not null check (method in ('card','transfer','check','cash','standing_order','other')),
  source text not null check (source in ('manual','excel','bllink_import','provider')),
  external_id text,
  raw jsonb,
  note text,
  import_batch_id uuid references import_batch(id),
  created_by uuid references profile(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (source, external_id)
);
create index payment_unit_idx on payment (unit_id) where archived_at is null;
create index payment_building_idx on payment (building_id) where archived_at is null;

do $$
declare t text;
begin
  foreach t in array array['tariff','special_charge','special_charge_line','import_batch','payment'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy allowed_all on %I for all to authenticated using (is_allowed()) with check (is_allowed())', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end $$;
