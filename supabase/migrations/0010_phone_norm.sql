-- One canonical form of each phone (digits only, Israeli numbers as 972…), so the bot finds a person by an equality match.
-- It follows normalizePhone in src/lib/bot/phone.ts. A generated column stays correct for every writer (dashboard, imports, bot).
alter table person add column phone_norm text generated always as (
  case
    when regexp_replace(coalesce(phone, ''), '\D', '', 'g') = '' then null
    when regexp_replace(phone, '\D', '', 'g') like '972%' then regexp_replace(phone, '\D', '', 'g')
    when regexp_replace(phone, '\D', '', 'g') like '0%' then '972' || substr(regexp_replace(phone, '\D', '', 'g'), 2)
    else regexp_replace(phone, '\D', '', 'g')
  end
) stored;
create index person_phone_norm_idx on person (phone_norm) where archived_at is null;
