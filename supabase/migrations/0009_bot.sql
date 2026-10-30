-- WhatsApp bot (Track B). A guided chat with fixed rules: no AI, no third party reads resident messages.

-- Consent of each phone number to be messaged. One row per grant; revoked_at is set on "stop".
create table consent (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references person(id),
  phone text not null,
  text_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index consent_phone_idx on consent (phone);

-- The step of each guided chat. A chat that is silent for 24 hours is forgotten.
create table wa_conversation (
  phone text primary key,
  person_id uuid references person(id),
  step text not null,
  context jsonb not null default '{}',
  last_inbound_at timestamptz,
  expires_at timestamptz
);

-- Every message in and out. wa_message_id is unique, so a retried webhook is ignored.
create table message_log (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  phone text not null,
  wa_message_id text unique,
  template_name text,
  body text,
  ticket_id uuid references ticket(id),
  delivery_state text check (delivery_state in ('queued','sent','delivered','read','failed')),
  error text,
  needs_agent boolean not null default false,
  created_at timestamptz not null default now()
);
create index message_log_phone_idx on message_log (phone, created_at desc);
create index message_log_agent_idx on message_log (created_at) where needs_agent;

-- What the rules proposed for a ticket, and what a founder changed.
create table proposal_log (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references ticket(id),
  proposed jsonb not null,
  roy_correction jsonb,
  created_at timestamptz not null default now()
);

-- Mirror of the Meta template status.
create table wa_template (
  name text primary key,
  language text not null default 'he',
  body text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  meta_id text
);
insert into wa_template (name) values ('ticket_assigned'), ('ticket_visit'), ('ticket_done'), ('ticket_info');

-- A danger alert sent to a founder. A repeat points to the first alert.
create table alert (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references ticket(id),
  channel text not null check (channel in ('sms','whatsapp')),
  to_phone text not null,
  sent_at timestamptz not null default now(),
  delivery_state text,
  repeat_of uuid references alert(id)
);

alter table ticket add column source text not null default 'dispatcher' check (source in ('dispatcher','whatsapp'));
alter table ticket add column resident_approved boolean not null default true;
alter table ticket add column duplicate_of_id uuid references ticket(id);
alter table ticket add column responsibility text not null default 'לא ידוע' check (responsibility in ('החברה','הוועד','בעל דירה או שוכר','אחריות ספק','לא ידוע'));

alter table ticket_event drop constraint ticket_event_type_check;
alter table ticket_event add constraint ticket_event_type_check check (type in ('created','status','assignment','note','photo','edit','message'));

alter table person add column opted_out_at timestamptz;
-- A link made by a founder is approved at once (default now()). The bot inserts NULL: a resident who claimed an apartment waits for approval.
alter table unit_person add column approved_at timestamptz default now();

do $$
declare t text;
begin
  foreach t in array array['consent','wa_conversation','message_log','proposal_log','wa_template','alert'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy allowed_all on %I for all to authenticated using (is_allowed()) with check (is_allowed())', t);
    execute format('grant select, insert, update on %I to authenticated', t);
  end loop;
end $$;
