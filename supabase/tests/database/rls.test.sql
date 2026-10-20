begin;
select plan(27);

-- Rows in every table, created as the database owner, so "sees nothing" is a real result.
insert into person (id, name, role) values ('00000000-0000-0000-0000-0000000000a1', 'בודק', 'founder');
insert into profile (email, person_id) values ('allowed@test.local', '00000000-0000-0000-0000-0000000000a1');
insert into building (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'בניין בדיקה');
insert into unit (id, building_id, number) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '1');
insert into unit_person (unit_id, person_id, relation) values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'owner');
insert into employee_profile (person_id, job_role) values ('00000000-0000-0000-0000-0000000000a1', 'בדיקה');
insert into supplier_profile (person_id, category, tier) values ('00000000-0000-0000-0000-0000000000a1', 'חשמל', 'קבוע');
insert into maintenance_item (id, building_id, system) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000b1', 'בדיקת גג');
insert into ticket (id, kind, category, title) values ('00000000-0000-0000-0000-0000000000c9', 'fault', 'חשמל', 'קיימת');
insert into ticket_event (ticket_id, type) values ('00000000-0000-0000-0000-0000000000c9', 'created');
insert into attachment (ticket_id, kind, storage_path) values ('00000000-0000-0000-0000-0000000000c9', 'photo', 'x/y.png');
insert into maintenance_log (item_id, done_at) values ('00000000-0000-0000-0000-0000000000e1', current_date);
insert into setting (key, value) values ('rls-test', 'true');
insert into reminder_log (item_id, kind, due_date) values ('00000000-0000-0000-0000-0000000000e1', 'due', current_date);
insert into storage.objects (bucket_id, name, owner) values ('attachments', 'rls-test.png', null);

-- allowed user
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"allowed@test.local"}', true);
select is((select count(*) from building where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'allowed user reads the test building');
select lives_ok($$insert into building (name) values ('חדש')$$, 'allowed user inserts a building');
select cmp_ok((select count(*) from storage.objects where bucket_id = 'attachments' and name = 'rls-test.png')::int, '=', 1, 'allowed user sees the storage object');

-- a mixed-case email still matches the allowlist
select set_config('request.jwt.claims', '{"role":"authenticated","email":"Allowed@Test.Local"}', true);
select is((select count(*) from building where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'email match ignores case');

-- a signed-in user who is not on the list sees nothing in any table
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@test.local"}', true);
select is((select count(*) from profile)::int, 0, 'stranger reads no profile');
select is((select count(*) from person)::int, 0, 'stranger reads no person');
select is((select count(*) from building)::int, 0, 'stranger reads no building');
select is((select count(*) from unit)::int, 0, 'stranger reads no unit');
select is((select count(*) from unit_person)::int, 0, 'stranger reads no unit_person');
select is((select count(*) from employee_profile)::int, 0, 'stranger reads no employee_profile');
select is((select count(*) from supplier_profile)::int, 0, 'stranger reads no supplier_profile');
select is((select count(*) from maintenance_item)::int, 0, 'stranger reads no maintenance_item');
select is((select count(*) from ticket)::int, 0, 'stranger reads no ticket');
select is((select count(*) from ticket_event)::int, 0, 'stranger reads no ticket_event');
select is((select count(*) from attachment)::int, 0, 'stranger reads no attachment');
select is((select count(*) from maintenance_log)::int, 0, 'stranger reads no maintenance_log');
select is((select count(*) from setting)::int, 0, 'stranger reads no setting');
select is((select count(*) from reminder_log)::int, 0, 'stranger reads no reminder_log');
select is((select count(*) from storage.objects where bucket_id = 'attachments')::int, 0, 'stranger sees no stored files');
select throws_ok($$insert into building (name) values ('פריצה')$$, '42501', null, 'stranger cannot insert');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('attachments', 'hack.png')$$, '42501', null, 'stranger cannot upload');

-- anonymous
reset role;
set local role anon;
select is((select count(*) from building)::int, 0, 'anonymous reads no buildings');
select is((select count(*) from ticket)::int, 0, 'anonymous reads no tickets');

-- soft delete and the first-action trigger (as allowed user)
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"allowed@test.local"}', true);
update building set archived_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
select is((select count(*) from building where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'archived building row still exists');

insert into ticket (id, kind, category, title) values ('00000000-0000-0000-0000-0000000000c1', 'fault', 'חשמל', 'בדיקת טריגר');
select is((select first_action_at from ticket where id = '00000000-0000-0000-0000-0000000000c1'), null, 'new unassigned ticket has no first action');
update ticket set status = 'בטיפול' where id = '00000000-0000-0000-0000-0000000000c1';
select isnt((select first_action_at from ticket where id = '00000000-0000-0000-0000-0000000000c1'), null, 'first status change sets first action');
-- Pin the value to the past. now() is frozen inside a transaction, so only a known old value can show an overwrite.
update ticket set first_action_at = '2020-01-01 00:00:00+00' where id = '00000000-0000-0000-0000-0000000000c1';
update ticket set status = 'ממתין' where id = '00000000-0000-0000-0000-0000000000c1';
select is((select first_action_at from ticket where id = '00000000-0000-0000-0000-0000000000c1'), '2020-01-01 00:00:00+00'::timestamptz, 'second change keeps the first action time');

select * from finish();
rollback;
