-- Test del check-in con tablet (0011). Eseguire su un Postgres locale dopo stub.sql e le migrazioni 0001-0011.
-- Utenti: a = admin, c = cliente approvato con 10 ingressi, d = in attesa di approvazione, e = senza abbonamento.
\set ON_ERROR_STOP 0
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000c','c@x'),
 ('00000000-0000-0000-0000-00000000000d','d@x'),('00000000-0000-0000-0000-00000000000e','e@x');
insert into public.profiles(id,first_name,last_name,role,approval_status) values
 ('00000000-0000-0000-0000-00000000000a','Ad','Min','admin','approved'),
 ('00000000-0000-0000-0000-00000000000c','Mario','Rossi','client','approved'),
 ('00000000-0000-0000-0000-00000000000d','Pino','Pend','client','pending'),
 ('00000000-0000-0000-0000-00000000000e','Elio','Nomem','client','approved')
on conflict (id) do update set role=excluded.role, approval_status=excluded.approval_status, first_name=excluded.first_name, last_name=excluded.last_name;
update public.gym_settings set block_without_certificate=false;
insert into public.memberships(user_id,plan_name,entries_left,end_date) values
 ('00000000-0000-0000-0000-00000000000c','10 ingressi',2,current_date+30),
 ('00000000-0000-0000-0000-00000000000d','Mensile',null,current_date+30);
select id, role, approval_status from public.profiles;
-- admin crea tablet
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000000a';
select public.admin_kiosk_create('Ingresso') as secret \gset
-- client non può creare
set test.uid='00000000-0000-0000-0000-00000000000c';
select public.admin_kiosk_create('x');
-- anon: tabelle private inaccessibili
reset role; set role anon;
select count(*) from private.kiosk_codes;
select public.kiosk_checkin('00');
select public.kiosk_poll('deadbeef');
select (public.kiosk_poll(:'secret')) ->> 'code' as code \gset
\echo code :code
-- C entra
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000000c';
select public.kiosk_checkin(:'code');
-- C ripete: duplicate
select public.kiosk_checkin(:'code') ->> 'status';
-- D (pending) usa codice usato -> used
set test.uid='00000000-0000-0000-0000-00000000000d';
select public.kiosk_checkin(:'code') ->> 'status';
reset role; set role anon;
select (public.kiosk_poll(:'secret')) ->> 'code' as code2 \gset
\echo new code differs? :code2
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000000d';
select public.kiosk_checkin(:'code2');
set test.uid='00000000-0000-0000-0000-00000000000e';
select public.kiosk_checkin(:'code2') ->> 'reason';
reset role; set role anon;
select jsonb_pretty(public.kiosk_poll(:'secret') -> 'events');
-- scaduto
reset role; update private.kiosk_codes set expires_at = now() - interval '11 seconds' where code = :'code2';
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000000c';
select public.kiosk_checkin(:'code2') ->> 'status';
-- direct calls of private
select private.do_checkin('00000000-0000-0000-0000-00000000000c', null, null);
select private.is_approved('00000000-0000-0000-0000-00000000000c');
insert into public.checkins(user_id) values ('00000000-0000-0000-0000-00000000000c');
-- revoke
set test.uid='00000000-0000-0000-0000-00000000000a';
select name, revoked_at is null, checkins_today from public.admin_kiosk_list();
select public.admin_kiosk_revoke((select id from public.admin_kiosk_list() limit 1));
reset role; set role anon; select public.kiosk_poll(:'secret');
reset role;
select user_id, allowed, reason, method, kiosk_id is not null from public.checkins;
select entries_left from public.memberships where user_id='00000000-0000-0000-0000-00000000000c';
-- certificato non verificato con blocco attivo
update public.gym_settings set block_without_certificate=true;
insert into public.medical_certificates(user_id, expires_on, verified) values ('00000000-0000-0000-0000-00000000000e', '2099-01-01', false);
insert into public.memberships(user_id,plan_name,end_date) values ('00000000-0000-0000-0000-00000000000e','Mensile',current_date+30);
insert into private.kiosk_devices(name, secret_hash) values ('t2', extensions.digest(repeat('a',64),'sha256'));
set role anon; select (public.kiosk_poll(repeat('a',64))) ->> 'code' as code3 \gset
set role authenticated; set test.uid='00000000-0000-0000-0000-00000000000e';
select public.kiosk_checkin(:'code3') ->> 'reason' as cert_reason;
-- rate limit
select public.kiosk_checkin(repeat('0',32)) ->> 'status' from generate_series(1,12);
reset role;
