\set ON_ERROR_STOP 0
\pset footer off
-- nuova registrazione
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000bb','new@x.it','{"first_name":"Nuovo"}');
insert into auth.users(id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000ee','EnricoDelPrincipeMain@gmail.com','{"first_name":"Fake"}');
select email, role, approval_status from public.profiles order by email;
insert into public.memberships(user_id,plan_name,end_date) values ('00000000-0000-0000-0000-0000000000bb','Mensile',current_date+30);
insert into public.sessions(title,starts_at,ends_at) values ('Boxe', now()+interval '1 day', now()+interval '1 day 1 hour');
update public.gym_settings set block_without_certificate=false;

\echo '--- come utente IN ATTESA'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000bb';
select count(*) as profili_visibili from public.profiles;
select count(*) as esercizi from public.exercises;
select count(*) as abbonamenti from public.memberships;
select count(*) as notifiche from public.notifications;
insert into public.workout_logs(user_id,exercise_name) values (auth.uid(),'x');
insert into public.goals(user_id,title) values (auth.uid(),'x');
insert into public.medical_certificates(user_id,expires_on) values (auth.uid(), current_date+300);
insert into storage.objects(bucket_id,name) values ('avatars', auth.uid()||'/a.png');
insert into public.messages(sender_id,recipient_id,body) values (auth.uid(),'00000000-0000-0000-0000-00000000000a','ciao');
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values (auth.uid(),'https://x','a','b');
select public.book_session((select id from public.sessions limit 1));
select count(*) as staff from public.get_staff();
select public.gym_occupancy() is null as occupancy_nascosta;
update public.profiles set approval_status='approved', role='admin', first_name='Hack' where id=auth.uid();
select public.review_signup(auth.uid(), true);
insert into public.leads(full_name) values ('Prova lead');
reset role;
select first_name, role, approval_status from public.profiles where email='new@x.it';

\echo '--- come cliente APPROVATO (vecchio): tenta auto-promozione e cambio email'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
select count(*) as esercizi from public.exercises;
update public.profiles set role='admin', approval_status='approved', email='enricodelprincipemain@gmail.com', first_name='Oldy' where id=auth.uid();
select public.review_signup('00000000-0000-0000-0000-0000000000bb', true);
reset role;
select first_name, email, role from public.profiles where id='00000000-0000-0000-0000-00000000000c';

\echo '--- come RECEPTION'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000e';
select public.review_signup('00000000-0000-0000-0000-0000000000bb', true);
update public.profiles set approval_status='approved' where id='00000000-0000-0000-0000-0000000000bb';
select public.checkin((select qr_token from public.profiles where id='00000000-0000-0000-0000-0000000000bb'))->>'reason' as checkin;
reset role;
select approval_status from public.profiles where email='new@x.it';

\echo '--- come ADMIN: approva'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000a';
select public.review_signup('00000000-0000-0000-0000-00000000000a', true);
select public.review_signup('00000000-0000-0000-0000-0000000000bb', true);
select public.review_signup('00000000-0000-0000-0000-0000000000ee', false, 'Non ti conosciamo');
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000bb';
select count(*) as esercizi from public.exercises;
select title from public.notifications;
select public.book_session((select id from public.sessions limit 1));
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000e';
select public.checkin((select qr_token from public.profiles where id='00000000-0000-0000-0000-0000000000bb'))->>'allowed' as checkin_dopo;
reset role;
select email, approval_status, rejection_reason from public.profiles where email ilike 'enrico%';
select action, details->'after'->>'approval_status' from public.audit_log where table_name='profiles';
update public.gym_settings set block_without_certificate=true;
insert into public.memberships(user_id,plan_name,end_date) values ('00000000-0000-0000-0000-00000000000c','Mensile',current_date+30);
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000c';
insert into public.medical_certificates(user_id,expires_on,file_path) values (auth.uid(), '2099-01-01', '00000000-0000-0000-0000-0000000000bb/x.pdf');
insert into public.medical_certificates(user_id,expires_on,file_path) values (auth.uid(), '2099-01-01', auth.uid()||'/x.pdf');
select public.book_session((select id from public.sessions limit 1));
reset role;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-00000000000e';
select public.checkin((select qr_token from public.profiles where id='00000000-0000-0000-0000-00000000000c'))->>'reason' as prima;
update public.medical_certificates set verified=true where user_id='00000000-0000-0000-0000-00000000000c';
select public.checkin((select qr_token from public.profiles where id='00000000-0000-0000-0000-00000000000c'))->>'allowed' as dopo_verifica;
