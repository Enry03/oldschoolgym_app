\set ON_ERROR_STOP 0
\pset footer off
-- Test manuale di 0013 (dopo seed.sql, 0010, 0011, 0012). Gli ERROR attesi sono i blocchi.
select rules_version, privacy_version from public.gym_settings;
insert into auth.users(id,email,raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000001b1','pv_ok@x.it','{"first_name":"Ok","birth_date":"1990-05-01","consent_privacy":true,"consent_health":true,"consent_marketing":true,"rules_version":1,"privacy_version":1}'),
 ('00000000-0000-0000-0000-0000000001b2','pv_old@x.it','{"first_name":"Vecchia","birth_date":"1990-05-01","consent_privacy":true,"consent_health":true,"rules_version":1,"privacy_version":9}');
select email, consent_privacy, privacy_version from public.profiles where email like 'pv_%' order by email;
select p.email, kind, granted, version, actor_id is null as sistema from public.consent_log l join public.profiles p on p.id=l.user_id where p.email like 'pv_%' order by p.email, l.id;

update public.profiles set approval_status='approved' where email like 'pv_%';
\echo '--- il cliente non falsifica la versione né scrive nel registro'
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001b2';
update public.profiles set privacy_version=1 where id=auth.uid();
insert into public.consent_log(user_id,kind,granted) values (auth.uid(),'privacy',true); -- ERRORE
delete from public.consent_log; -- ERRORE o 0 righe
select count(*) as visibili_solo_miei from public.consent_log; -- solo i propri
select privacy_version as resta_null from public.profiles where id=auth.uid();
select public.accept_rules(1, true, 2); -- ERRORE: versione sbagliata
select public.accept_rules(1, true, 1); -- ok
select privacy_version as ora_1 from public.profiles where id=auth.uid();
select public.accept_rules(1, true); -- ok anche dall'app vecchia
update public.profiles set consent_marketing=true where id=auth.uid();
update public.profiles set consent_privacy=false where id=auth.uid(); -- revoca
select consent_privacy, privacy_version as null_dopo_revoca from public.profiles where id=auth.uid();
reset role;

\echo '--- admin alza la versione: nuova accettazione'
update public.gym_settings set privacy_version = 2 where id = 1;
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000001b1';
select public.accept_rules(1, true, 1); -- ERRORE: versione vecchia
select public.accept_rules(1, true, 2); -- ok
reset role;
\echo '--- genitore verificato'
set request.jwt.claim.sub='';
update public.profiles set guardian_verified_at=now() where email='pv_ok@x.it';
select p.email, kind, granted, version, actor_id is null as sistema from public.consent_log l join public.profiles p on p.id=l.user_id where p.email like 'pv_%' order by p.email, l.id;
