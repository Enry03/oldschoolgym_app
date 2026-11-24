-- Test di 0017 (diario, record, traguardi, foto condivise, avvisi, messaggi).
-- Su un Postgres locale con le migrazioni 0001-0017 (mai su produzione).
-- Ogni controllo stampa "OK ..." oppure "FALLITO ...": alla fine non deve esserci nessun FALLITO.
\set ON_ERROR_STOP 1
\pset footer off
set client_min_messages = notice;
begin; -- tutto annullato alla fine

create schema if not exists t;
grant usage on schema t to authenticated, anon;
create or replace function t.ok(c boolean, label text) returns void language plpgsql as $$
begin raise notice '%', case when coalesce(c, false) then 'OK ' else 'FALLITO ' end || label; end $$;
create or replace function t.fails(q text, label text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'OK % (bloccato: %)', label, sqlerrm; return; end;
  raise notice 'FALLITO % (doveva essere bloccato)', label;
end $$;
create or replace function t.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, false), set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false)
$$;
grant execute on all functions in schema t to authenticated, anon;

-- ----- utenti: A admin, T trainer, C1 cliente di T, C2 cliente senza trainer, R reception
insert into auth.users (id, email, instance_id, aud, role, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','a1@test.it','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{"first_name":"Ada","last_name":"Admin"}'),
 ('00000000-0000-0000-0000-0000000000b1','t1@test.it','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{"first_name":"Tino","last_name":"Trainer"}'),
 ('00000000-0000-0000-0000-0000000000c1','c1@test.it','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{"first_name":"Carlo","last_name":"Uno"}'),
 ('00000000-0000-0000-0000-0000000000c2','c2@test.it','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{"first_name":"Cinzia","last_name":"Due"}'),
 ('00000000-0000-0000-0000-0000000000d1','r1@test.it','00000000-0000-0000-0000-000000000000','authenticated','authenticated','{"first_name":"Rita","last_name":"Reception"}')
on conflict (id) do nothing;
update public.profiles set approval_status = 'approved', is_active = true,
  role = case email when 'a1@test.it' then 'admin' when 't1@test.it' then 'trainer' when 'r1@test.it' then 'reception' else 'client' end::public.user_role,
  first_name = coalesce(nullif(first_name, ''), split_part(email, '@', 1)), last_name = coalesce(nullif(last_name, ''), 'Test')
 where email like '%@test.it';
update public.profiles set trainer_id = '00000000-0000-0000-0000-0000000000b1' where email = 'c1@test.it';
update public.profiles set created_at = now() - interval '30 days' where email = 'c2@test.it';
-- gli admin "veri" del DB di test non devono confondere i conteggi
update public.profiles set is_active = false where email not like '%@test.it' and role = 'admin';

insert into public.memberships (user_id, plan_name, entries_left, start_date, end_date, status) values
 ('00000000-0000-0000-0000-0000000000c1', '10 ingressi', 12, current_date - 10, current_date + 60, 'active'),
 ('00000000-0000-0000-0000-0000000000c2', 'Mensile', null, current_date - 20, current_date + 10, 'active');
insert into public.workout_plans (id, user_id, title, starts_on, created_by) values
 ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000c1', 'Forza A', current_date - 43, '00000000-0000-0000-0000-0000000000b1'),
 ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-0000000000c2', 'Tono B', current_date - 60, '00000000-0000-0000-0000-0000000000a1');
insert into public.workout_plan_items (id, plan_id, exercise_name) values
 ('00000000-0000-0000-0000-00000000e001', '00000000-0000-0000-0000-00000000f001', 'Panca piana'),
 ('00000000-0000-0000-0000-00000000e002', '00000000-0000-0000-0000-00000000f002', 'Squat');
delete from public.notifications;

\echo '===== DIARIO ====='
set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.workout_logs (user_id, plan_item_id, exercise_name, performed_on, set_number, weight_kg, reps) values
 (auth.uid(), '00000000-0000-0000-0000-00000000e001', 'Panca piana', current_date - 7, 1, 80, 8),
 (auth.uid(), '00000000-0000-0000-0000-00000000e001', 'Panca piana', current_date - 7, 2, 80, 6);
select t.ok((select count(*) = 0 from public.personal_records), 'prima volta: nessun record (non c''è niente da battere)');
insert into public.workout_logs (user_id, plan_item_id, exercise_name, performed_on, set_number, weight_kg, reps) values
 (auth.uid(), '00000000-0000-0000-0000-00000000e001', 'Panca piana', current_date, 1, 82.5, 8),
 (auth.uid(), '00000000-0000-0000-0000-00000000e001', 'Panca piana', current_date, 2, 85, 5);
select t.ok((select weight_kg = 85 and previous_kg = 80 from public.personal_records where user_id = auth.uid()), 'record 85 kg (prima 80) registrato una volta sola');
select t.ok((select count(*) = 1 from public.notifications where user_id = auth.uid() and kind = 'record'), 'il cliente riceve UNA notifica di record');
select t.ok((select string_agg(code, ',' order by code) = 'diario_1,record_1' from public.user_badges where user_id = auth.uid()), 'traguardi diario_1 e record_1');
select t.fails($$insert into public.workout_logs (user_id, exercise_name, weight_kg) values ('00000000-0000-0000-0000-0000000000c2', 'Squat', 50)$$, 'scrivere nel diario di un altro');
select t.fails($$insert into public.workout_logs (user_id, plan_item_id, exercise_name, weight_kg) values (auth.uid(), '00000000-0000-0000-0000-00000000e002', 'Squat', 50)$$, 'usare la scheda di un altro');
select t.fails($$insert into public.workout_logs (user_id, exercise_name, weight_kg) values (auth.uid(), 'Panca', 2000)$$, 'peso assurdo 2000 kg');
select t.fails($$insert into public.workout_logs (user_id, exercise_name, weight_kg, performed_on) values (auth.uid(), 'Panca', 50, current_date + 10)$$, 'data nel futuro');
select t.fails($$insert into public.personal_records (user_id, exercise_key, exercise_name, weight_kg, achieved_on) values (auth.uid(), 'x', 'x', 999, current_date)$$, 'record finto scritto a mano');
select t.fails($$insert into public.user_badges (user_id, code) values (auth.uid(), 'ingressi_200')$$, 'traguardo finto scritto a mano');
select t.fails($$update public.workout_logs set weight_kg = 300 where user_id = auth.uid()$$, 'modificare il peso già salvato (solo cancella e riscrivi)');

select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) = 4 from public.workout_logs where user_id = '00000000-0000-0000-0000-0000000000c1'), 'il trainer vede il diario del suo cliente');
select t.ok((select count(*) = 1 from public.personal_records where user_id = '00000000-0000-0000-0000-0000000000c1'), 'il trainer vede i record del suo cliente');
select t.ok((select count(*) = 1 from public.notifications where user_id = auth.uid() and kind = 'record'), 'il trainer riceve la notifica del record');
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select t.ok((select count(*) = 0 from public.workout_logs where user_id = '00000000-0000-0000-0000-0000000000c1'), 'un altro cliente NON vede il diario');
select t.ok((select count(*) = 0 from public.user_badges where user_id = '00000000-0000-0000-0000-0000000000c1'), 'un altro cliente NON vede i traguardi');

select t.as_user('00000000-0000-0000-0000-0000000000c1');
delete from public.workout_logs where user_id = auth.uid() and performed_on = current_date;
select t.ok((select count(*) = 0 from public.personal_records where user_id = auth.uid()), 'cancellando le serie di oggi sparisce anche il record di oggi');
insert into public.workout_logs (user_id, plan_item_id, exercise_name, performed_on, set_number, weight_kg, reps) values
 (auth.uid(), '00000000-0000-0000-0000-00000000e001', 'Panca piana', current_date, 1, 85, 5);
select t.ok((select count(*) = 1 from public.notifications where user_id = auth.uid() and kind = 'record'), 'riscrivendo lo stesso record nessuna notifica doppia');

\echo '===== FOTO ====='
insert into public.progress_photos (id, user_id, file_path) values ('00000000-0000-0000-0000-0000000000f1', auth.uid(), auth.uid() || '/foto1.jpg');
reset role;
insert into storage.objects (bucket_id, name) values ('progress', '00000000-0000-0000-0000-0000000000c1/foto1.jpg');
set role authenticated;
select t.fails($$insert into public.progress_photos (user_id, file_path) values (auth.uid(), '00000000-0000-0000-0000-0000000000c2/x.jpg')$$, 'foto che punta alla cartella di un altro');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) = 0 from public.progress_photos where user_id = '00000000-0000-0000-0000-0000000000c1'), 'foto NON condivisa: il trainer non la vede');
select t.ok((select count(*) = 0 from storage.objects where bucket_id = 'progress'), 'foto NON condivisa: il trainer non apre il file');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
update public.progress_photos set shared_with_coach = true where id = '00000000-0000-0000-0000-0000000000f1';
select t.fails($$update public.progress_photos set user_id = '00000000-0000-0000-0000-0000000000c2' where id = '00000000-0000-0000-0000-0000000000f1'$$, 'spostare la foto su un altro utente');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.ok((select count(*) = 1 from public.progress_photos where user_id = '00000000-0000-0000-0000-0000000000c1'), 'foto condivisa: il trainer la vede');
select t.ok((select count(*) = 1 from storage.objects where bucket_id = 'progress'), 'foto condivisa: il trainer apre il file');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.ok((select count(*) = 1 from storage.objects where bucket_id = 'progress'), 'foto condivisa: anche l''admin (gestore) la apre');
select t.as_user('00000000-0000-0000-0000-0000000000d1');
select t.ok((select count(*) = 0 from public.progress_photos), 'la reception NON vede le foto');
select t.ok((select count(*) = 0 from storage.objects where bucket_id = 'progress'), 'la reception NON apre i file');
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select t.ok((select count(*) = 0 from public.progress_photos), 'un altro cliente NON vede le foto');
select t.ok((select count(*) = 0 from storage.objects where bucket_id = 'progress'), 'un altro cliente NON apre il file');

\echo '===== MISURE E TRAGUARDI DEGLI INGRESSI ====='
select t.as_user('00000000-0000-0000-0000-0000000000c1');
insert into public.measurements (user_id, weight_kg, created_by) values (auth.uid(), 80, auth.uid());
select t.ok((select count(*) = 1 from public.user_badges where user_id = auth.uid() and code = 'misure_1'), 'prima misura → traguardo "Si parte"');
reset role;
-- 8 ingressi in 4 settimane (2 a settimana) + 2 = 10
insert into public.checkins (user_id, checked_at, allowed)
select '00000000-0000-0000-0000-0000000000c1', date_trunc('week', now()) - make_interval(weeks => w) + make_interval(days => d, hours => 10), true
from generate_series(0, 3) w, generate_series(0, 1) d;
insert into public.checkins (user_id, checked_at, allowed) values
 ('00000000-0000-0000-0000-0000000000c1', now() - interval '40 days', true), ('00000000-0000-0000-0000-0000000000c1', now() - interval '41 days', true),
 ('00000000-0000-0000-0000-0000000000c1', now() - interval '42 days', false);
select t.ok((select string_agg(code, ',' order by code) from public.user_badges where user_id = '00000000-0000-0000-0000-0000000000c1')
  = 'costanza_4,diario_1,ingressi_1,ingressi_10,misure_1,record_1', 'traguardi ingressi_1, ingressi_10 e costanza (rifiutati non contano)');
select t.ok((select count(*) = 6 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'badge'), 'una notifica per ogni traguardo, nessun doppione');

\echo '===== AVVISI AUTOMATICI ====='
-- C1: ultimo ingresso oggi/questa settimana; 1 ingresso rimasto. C2: nessun ingresso, iscritta da 30 giorni.
update public.memberships set entries_left = 1 where user_id = '00000000-0000-0000-0000-0000000000c1';
delete from public.notifications;
-- i nuovi avvisi partono solo tra le 9 e le 20 ora italiana: lanciare il test in quella fascia
select t.ok(extract(hour from now() at time zone 'Europe/Rome') between 9 and 19, 'test lanciato di giorno (ora di Roma)');
select private.run_reminders();
select private.run_reminders(); -- seconda esecuzione: nessun doppione
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and title = 'Ti resta 1 ingresso'), 'cliente: "Ti resta 1 ingresso" (una volta sola)');
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and kind = 'absence'), 'cliente assente da 30 giorni: "Ci manchi"');
select t.ok((select count(*) = 0 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'absence'), 'chi è venuto di recente non riceve "Ci manchi"');
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'followup'), 'assente senza trainer → avviso all''admin');
select t.ok((select count(*) = 0 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'followup'), 'il trainer non riceve avvisi di clienti non suoi');
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000b1' and kind = 'plan_change'), 'scheda di 6 settimane → avviso al trainer');
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'plan_change'), 'scheda di 8 settimane senza trainer → avviso all''admin');
select t.ok((select count(*) = 0 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c1' and kind = 'plan_change'), 'cliente con scheda di 6 settimane: ancora nessun avviso');
select t.ok((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000c2' and kind = 'plan_change'), 'cliente con scheda di 8 settimane: avviso');
-- nuova scheda più recente: quella vecchia non conta più
insert into public.workout_plans (user_id, title, starts_on, created_by) values ('00000000-0000-0000-0000-0000000000c1', 'Forza B', current_date, '00000000-0000-0000-0000-0000000000b1');

set role authenticated;
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.ok((select jsonb_array_length(f->'plans') = 0 and jsonb_array_length(f->'entries') = 1 and jsonb_array_length(f->'absent') = 0 from public.staff_followups() f),
  'trainer: lista "da seguire" solo con i suoi clienti (ingressi finiti C1, scheda nuova non segnalata)');
select t.as_user('00000000-0000-0000-0000-0000000000a1');
select t.ok((select jsonb_array_length(f->'plans') = 1 and jsonb_array_length(f->'absent') = 1 and (f->'absent'->0->>'days')::int = 30 from public.staff_followups() f),
  'admin: vede assente da 30 giorni e scheda di C2');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.fails($$select public.staff_followups()$$, 'un cliente non legge la lista dello staff');
select t.fails($$select private.run_reminders()$$, 'un cliente non lancia i promemoria');
select t.fails($$select private.award_badge(auth.uid(), 'ingressi_200')$$, 'un cliente non si regala traguardi');

\echo '===== MESSAGGI ====='
insert into public.messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', 'Ciao Tino, posso cambiare la scheda?');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select t.ok((select link = '/staff/messaggi?con=00000000-0000-0000-0000-0000000000c1' from public.notifications where user_id = auth.uid() and kind = 'message'), 'notifica al trainer con link alla chat giusta');
select t.ok((select unread = 1 and not last_mine from public.my_conversations() where peer_id = '00000000-0000-0000-0000-0000000000c1'), 'trainer: 1 non letto nella conversazione');
update public.messages set read_at = now() where recipient_id = auth.uid();
insert into public.messages (sender_id, recipient_id, body, created_at) values (auth.uid(), '00000000-0000-0000-0000-0000000000c1', 'Certo, ne parliamo domani', now() + interval '1 second');
select t.ok((select unread = 0 and last_mine from public.my_conversations() where peer_id = '00000000-0000-0000-0000-0000000000c1'), 'trainer: letto, ultimo messaggio è suo');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
select t.ok((select link = '/app/messaggi?con=00000000-0000-0000-0000-0000000000b1' from public.notifications where user_id = auth.uid() and kind = 'message'), 'notifica al cliente con link alla chat giusta');
select t.ok((select count(*) = 1 from public.my_conversations()), 'il cliente vede solo la propria conversazione');
select t.fails($$insert into public.messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000c2', 'ciao')$$, 'cliente che scrive a un altro cliente');
select t.as_user('00000000-0000-0000-0000-0000000000c2');
select t.ok((select count(*) = 0 from public.messages), 'un altro cliente non legge i messaggi');
select t.as_user('00000000-0000-0000-0000-0000000000c1');
do $$ begin for i in 1..19 loop insert into public.messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', 'msg ' || i); end loop; end $$;
select t.fails($$insert into public.messages (sender_id, recipient_id, body) values (auth.uid(), '00000000-0000-0000-0000-0000000000b1', 'spam')$$, '21° messaggio in un minuto (anti-spam)');
reset role;

\echo '===== EXPORT GDPR ====='
set role authenticated;
select t.ok((select (d ? 'personal_records') and (d ? 'badges') and (d ? 'progress_photos') from public.export_my_data() d), 'l''export dei dati include record, traguardi e foto');
reset role;
rollback;
