begin;
select plan(11);

insert into person (id, name, role) values ('00000000-0000-0000-0000-0000000000a1', 'בודק', 'founder');
insert into profile (email, person_id) values ('allowed@test.local', '00000000-0000-0000-0000-0000000000a1');
insert into building (id, name) values ('00000000-0000-0000-0000-0000000000b1', 'בניין בדיקה');

-- allowed user
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","email":"allowed@test.local"}', true);
select is((select count(*) from building where id = '00000000-0000-0000-0000-0000000000b1')::int, 1, 'allowed user reads the test building');
select lives_ok($$insert into building (name) values ('חדש')$$, 'allowed user inserts a building');

-- signed-in user who is not on the list
select set_config('request.jwt.claims', '{"role":"authenticated","email":"stranger@test.local"}', true);
select is((select count(*) from building)::int, 0, 'stranger reads no buildings');
select is((select count(*) from person)::int, 0, 'stranger reads no people');
select is((select count(*) from ticket)::int, 0, 'stranger reads no tickets');
select throws_ok($$insert into building (name) values ('פריצה')$$, '42501', null, 'stranger cannot insert');

-- anonymous
reset role;
set local role anon;
select is((select count(*) from building)::int, 0, 'anonymous reads no buildings');

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
create temp table fa as select first_action_at as t from ticket where id = '00000000-0000-0000-0000-0000000000c1';
update ticket set status = 'ממתין' where id = '00000000-0000-0000-0000-0000000000c1';
select is((select first_action_at from ticket where id = '00000000-0000-0000-0000-0000000000c1'), (select t from fa), 'second change keeps the first action time');

select * from finish();
rollback;
