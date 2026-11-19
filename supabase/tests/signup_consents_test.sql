\set ON_ERROR_STOP 0
\pset footer off
-- Test manuale di 0012 (dopo seed.sql, 0010, 0011). Gli ERROR attesi sono i blocchi.
select rules_version as versione_regolamento, min_age, adult_age, require_photo_for_approval from public.gym_settings;

-- adulto completo, adulto senza consensi, minorenne con genitore, troppo giovane, data scritta male
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000001a1','adulto@x.it','{"first_name":"Adulto","birth_date":"1990-05-01","consent_privacy":true,"consent_health":true,"rules_version":1}'),
 ('00000000-0000-0000-0000-0000000001a2','noconsensi@x.it','{"first_name":"Senza","birth_date":"1990-05-01","consent_privacy":true,"rules_version":7}'),
 ('00000000-0000-0000-0000-0000000001a3','minore@x.it','{"first_name":"Minore","birth_date":"2011-01-10","consent_privacy":true,"consent_health":true,"rules_version":1,"guardian_name":"Mamma Rossi","guardian_phone":"333"}'),
 ('00000000-0000-0000-0000-0000000001a4','piccolo@x.it','{"first_name":"Piccolo","birth_date":"2016-01-10","consent_privacy":true,"consent_health":true,"rules_version":1}'),
 ('00000000-0000-0000-0000-0000000001a5','datamale@x.it','{"first_name":"Data","birth_date":"2001-02-30","consent_privacy":true,"consent_health":true,"rules_version":1}');
select first_name, birth_date, consent_health, rules_version, guardian_name, approval_status from public.profiles where email like '%@x.it' order by email;

\echo '--- admin approva'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select public.review_signup('00000000-0000-0000-0000-0000000001a1', true);  -- ERRORE: manca la foto
update public.profiles set avatar_url='00000000-0000-0000-0000-0000000001a1/a.jpg' where id='00000000-0000-0000-0000-0000000001a1';
insert into storage.objects(bucket_id,name) values ('avatars','00000000-0000-0000-0000-0000000001a1/a.jpg'); -- ok: foto dalla reception
select public.review_signup('00000000-0000-0000-0000-0000000001a1', true);  -- ok
update public.profiles set avatar_url='x/a.jpg' where id in ('00000000-0000-0000-0000-0000000001a2','00000000-0000-0000-0000-0000000001a3','00000000-0000-0000-0000-0000000001a4','00000000-0000-0000-0000-0000000001a5');
select public.review_signup('00000000-0000-0000-0000-0000000001a2', true);  -- ERRORE: regolamento non accettato
select public.review_signup('00000000-0000-0000-0000-0000000001a3', true);  -- ERRORE: modulo genitore
select public.review_signup('00000000-0000-0000-0000-0000000001a3', true, null, true);  -- ok
select public.review_signup('00000000-0000-0000-0000-0000000001a4', true, null, true);  -- ERRORE: età minima
select public.review_signup('00000000-0000-0000-0000-0000000001a5', true);  -- ERRORE: manca la data
reset role;
select first_name, approval_status, guardian_verified_at is not null as genitore_verificato from public.profiles where email like '%@x.it' order by email;

\echo '--- cliente approvato prova a falsificare'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001a3';
update public.profiles set birth_date='1980-01-01', rules_version=99, guardian_verified_at=null, guardian_name='Io' where id=auth.uid();
reset role;
select birth_date, rules_version, guardian_verified_at is not null as verificato, guardian_name from public.profiles where id='00000000-0000-0000-0000-0000000001a3';

\echo '--- regolamento modificato: nuova versione da riaccettare'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
update public.gym_settings set rules_text = rules_text || ' 13. Nuova regola.', rules_version = 1 where id = 1;
update public.gym_settings set tagline = 'x' where id = 1;
select rules_version as dovrebbe_essere_2 from public.gym_settings;
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001a1';
select public.accept_rules(1, true);   -- ERRORE: versione vecchia
select public.accept_rules(2, false);  -- ERRORE: serve consenso sanitario
select public.accept_rules(2, true);   -- ok
update public.profiles set consent_health=false where id=auth.uid(); -- revoca ok
update public.profiles set consent_health=true where id=auth.uid();  -- ignorato: si dà solo con accept_rules
reset role;
select rules_version, consent_health from public.profiles where id='00000000-0000-0000-0000-0000000001a1';

\echo '--- utente in attesa non carica foto, il cliente non scrive nella cartella di altri'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001a2';
insert into storage.objects(bucket_id,name) values ('avatars', auth.uid()||'/b.jpg'); -- ERRORE
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001a1';
insert into storage.objects(bucket_id,name) values ('avatars', '00000000-0000-0000-0000-0000000001a3/b.jpg'); -- ERRORE
reset role;

\echo '--- richieste di prova: max 3 per IP all''ora'
set role anon; set request.jwt.claim.sub=''; set request.headers='{"x-forwarded-for":"1.2.3.4, 10.0.0.1"}';
insert into public.leads(full_name) values ('Lead uno');
insert into public.leads(full_name) values ('Lead due');
insert into public.leads(full_name) values ('Lead tre');
insert into public.leads(full_name) values ('Lead quattro'); -- ERRORE
set request.headers='{"x-forwarded-for":"5.6.7.8"}';
insert into public.leads(full_name) values ('Altro IP'); -- ok
reset role;
select count(*) as lead_salvati, count(distinct ip_hash) as ip_diversi from public.leads where full_name like 'Lead%' or full_name='Altro IP';
