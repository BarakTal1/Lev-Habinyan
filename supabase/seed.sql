-- LOCAL DEVELOPMENT SEED. All names, phones and addresses are invented. Never load real resident data here.

-- Founders (people) and the local dev sign-in.
insert into person (id, name, phone, role) values
  ('10000000-0000-0000-0000-000000000001', 'רועי במבג׳י', '050-0000001', 'founder'),
  ('10000000-0000-0000-0000-000000000002', 'עומר שטיגליץ', '050-0000002', 'founder');

-- Local dev user (test value for the local database only).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'dev@lev.local', crypt('dev-password-local', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '{"sub":"20000000-0000-0000-0000-000000000001","email":"dev@lev.local"}', 'email', now(), now(), now());
insert into profile (id, email, person_id) values ('30000000-0000-0000-0000-000000000001', 'dev@lev.local', '10000000-0000-0000-0000-000000000001');

-- Buildings
insert into building (id, name, city) values
  ('b0000000-0000-0000-0000-000000000001', 'הירקון 112', 'תל אביב'),
  ('b0000000-0000-0000-0000-000000000002', 'סוקולוב 24', 'הרצליה פיתוח'),
  ('b0000000-0000-0000-0000-000000000003', 'דיזנגוף 78', 'תל אביב'),
  ('b0000000-0000-0000-0000-000000000004', 'ויצמן 9', 'תל אביב'),
  ('b0000000-0000-0000-0000-000000000005', 'אבא אחימאיר 5', 'הרצליה');

-- Units and residents (invented)
insert into unit (id, building_id, number)
select gen_random_uuid(), b.id, n::text from building b, generate_series(1, 6) n;

with r(name, phone, rel, committee, unit_no) as (values
  ('רונית אלמוג','052-0000101','owner',true,'3'), ('משה גבאי','054-0000102','tenant',false,'5'),
  ('ליאת שמעוני','050-0000103','owner',true,'1'), ('עמית פרידמן','053-0000104','tenant',false,'2'))
, ins as (
  insert into person (name, phone, role) select name, phone, case when committee then 'committee' else 'resident' end from r returning id, name)
insert into unit_person (unit_id, person_id, relation, is_committee)
select u.id, ins.id, r.rel, r.committee
from r join ins on ins.name = r.name
join unit u on u.building_id = 'b0000000-0000-0000-0000-000000000001' and u.number = r.unit_no;

-- Suppliers
with s(name, phone, cat, tier, sla, avail, area) as (values
  ('א.ש. חשמל ותאורה','052-0000201','חשמל','קבוע',true,'א׳–ה׳ 07:30–17:00','תל אביב'),
  ('ברק חשמל 24/7','050-0000202','חשמל','חירום',true,'24/7','מרכז והשרון'),
  ('צנרת השרון','054-0000203','אינסטלציה','דחוף',false,'א׳–ו׳ 07:00–19:00','הרצליה'),
  ('מעליות גל־עד','03-0000204','מעלית','קבוע',true,'24/7 לתקלות','כל האזורים'),
  ('אש־טק בטיחות','09-0000205','כיבוי אש','קבוע',true,'א׳–ה׳ 08:00–17:00','כל האזורים'),
  ('שערי אור','052-0000206','דלתות ושערים','דחוף',false,'א׳–ה׳ 08:00–18:00','תל אביב'))
, ins as (insert into person (name, phone, role) select name, phone, 'supplier' from s returning id, name)
insert into supplier_profile (person_id, category, tier, has_sla, availability, area)
select ins.id, s.cat, s.tier, s.sla, s.avail, s.area from s join ins on ins.name = s.name;

-- Employees
with e(name, phone, job, area) as (values
  ('יוסי מזרחי','052-0000301','אב בית','תל אביב'), ('מרים חדד','054-0000302','ניקיון','תל אביב'),
  ('סאמר עודה','050-0000303','אחזקה כללית','הרצליה'))
, ins as (insert into person (name, phone, role) select name, phone, 'employee' from e returning id, name)
insert into employee_profile (person_id, job_role, area) select ins.id, e.job, e.area from e join ins on ins.name = e.name;

-- Maintenance items: 12 systems per building. Dates are relative to today so Today looks alive.
insert into maintenance_item (building_id, system, applicable)
select b.id, s, true from building b,
  unnest(array['ניקיון','גינון','בדיקת מעלית','בדיקת כיבוי אש','הדברה','שעוני חשמל','בדיקת אינסטלציה','ניקוי פיר ביוב','בדיקת גג','משאבות','חיטוי מאגר מים','שער חניון']) s;

update maintenance_item set frequency_unit = 'month', frequency_count = 6, last_done_at = current_date - 190, next_due_at = current_date - 12
  where system = 'בדיקת כיבוי אש' and building_id = 'b0000000-0000-0000-0000-000000000003';
update maintenance_item set frequency_unit = 'year', frequency_count = 1, last_done_at = current_date - 360, next_due_at = current_date - 5
  where system = 'חיטוי מאגר מים' and building_id = 'b0000000-0000-0000-0000-000000000002';
update maintenance_item set frequency_unit = 'month', frequency_count = 6, last_done_at = current_date - 175, next_due_at = current_date + 3
  where system = 'בדיקת מעלית' and building_id = 'b0000000-0000-0000-0000-000000000001';
update maintenance_item set frequency_unit = 'month', frequency_count = 3, last_done_at = current_date - 85, next_due_at = current_date + 6
  where system = 'הדברה' and building_id = 'b0000000-0000-0000-0000-000000000005';
update maintenance_item set frequency_unit = 'month', frequency_count = 6, last_done_at = current_date - 170, next_due_at = current_date + 9
  where system = 'ניקוי פיר ביוב' and building_id = 'b0000000-0000-0000-0000-000000000003';
update maintenance_item set frequency_unit = 'month', frequency_count = 3, last_done_at = current_date - 40, next_due_at = current_date + 50
  where system in ('משאבות','שער חניון') and building_id in ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004');
update maintenance_item set applicable = false where system = 'גינון' and building_id in ('b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000004');

-- Tickets
insert into ticket (kind, building_id, category, urgency, status, title, due_at, created_at, assignee_id) values
  ('fault','b0000000-0000-0000-0000-000000000005','חשמל','סכנה','חדש','חוט חשמל חשוף בלובי',null, now() - interval '3 hours', null),
  ('fault','b0000000-0000-0000-0000-000000000002','מעלית','דחוף','חדש','המעלית תקועה בקומה 4',null, now() - interval '26 hours', null),
  ('fault','b0000000-0000-0000-0000-000000000004','אינסטלציה','דחוף','חדש','נזילה בחדר המדרגות',null, now() - interval '3 days', null),
  ('fault','b0000000-0000-0000-0000-000000000003','דלתות ושערים','חשוב מאוד','חדש','שער החניה לא נפתח',null, now() - interval '2 days', null),
  ('fault','b0000000-0000-0000-0000-000000000001','חשמל','חשוב','חדש','נורה שרופה בקומה 2',null, now() - interval '30 hours', null),
  ('fault','b0000000-0000-0000-0000-000000000003','אינטרנט','חשוב','חדש','ראוטר הלובי לא מגיב', current_date - 2, now() - interval '9 days', null),
  ('task','b0000000-0000-0000-0000-000000000001','כיבוי אש','חשוב מאוד','חדש','תשלום לבודק מטפים', current_date - 3, now() - interval '12 days', '10000000-0000-0000-0000-000000000001'),
  ('task','b0000000-0000-0000-0000-000000000001','גינון','חשוב','חדש','תשלום לגנן – אוקטובר', current_date, now() - interval '5 days', '10000000-0000-0000-0000-000000000002'),
  ('task',null,'ביטוח','חשוב','חדש','חידוש ביטוח מבנה', current_date + 11, now() - interval '7 days', '10000000-0000-0000-0000-000000000002');
