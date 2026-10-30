-- 1. A retried webhook can be told apart from a message that is still being handled.
alter table message_log add column received_at timestamptz not null default now();
alter table message_log add column processed_at timestamptz;
update message_log set received_at = created_at, processed_at = created_at;

-- 2. One canonical phone form, written as a function that normalizePhone in src/lib/bot/phone.ts mirrors.
-- Digits 0-9 only; a leading 00 is dropped; 972 keeps no extra 0 after it; a leading 0 becomes 972.
create function phone_normalize(p text) returns text language sql immutable parallel safe as $$
  select case
    when d = '' then null
    when d like '972%' then '972' || regexp_replace(substr(d, 4), '^0', '')
    when d like '0%' then '972' || substr(d, 2)
    else d
  end
  from (select regexp_replace(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), '^00', '') as d) s
$$;

drop index person_phone_norm_idx;
alter table person drop column phone_norm;
alter table person add column phone_norm text generated always as (phone_normalize(phone)) stored;
create index person_phone_norm_idx on person (phone_norm) where archived_at is null;
