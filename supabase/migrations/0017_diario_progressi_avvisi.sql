-- 0017: diario allenamento, progressi e foto condivise, record personali, traguardi,
-- avvisi automatici (ingressi in esaurimento, assenze, cambio scheda) e messaggi.
-- (0016 è del thread "schede ed esercizi": questo file non tocca exercises né workout_plans.)

-- ===== Impostazioni =====
alter table public.gym_settings
  add column if not exists plan_change_weeks int not null default 6 check (plan_change_weeks between 2 and 26);
-- assenza: Enrico ha chiesto 10 giorni (prima il valore di partenza era 14)
update public.gym_settings set inactivity_days = 10 where id = 1 and inactivity_days = 14;

-- ===== Chi segue un cliente: il suo trainer, altrimenti gli admin =====
create or replace function private.coaches_of(p_client uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select t.id from public.profiles c join public.profiles t on t.id = c.trainer_id
   where c.id = p_client and t.is_active and t.role in ('trainer','admin') and private.is_approved(t.id)
  union
  select a.id from public.profiles a
   where a.role = 'admin' and a.is_active and private.is_approved(a.id)
     and not exists (select 1 from public.profiles c join public.profiles t on t.id = c.trainer_id
                     where c.id = p_client and t.is_active and t.role in ('trainer','admin') and private.is_approved(t.id))
$$;

-- ===== Diario: valori sensati e solo sulla propria scheda =====
alter table public.workout_logs
  add constraint wl_weight_ck check (weight_kg is null or weight_kg between 0 and 1000),
  add constraint wl_reps_ck check (reps is null or reps between 0 and 1000),
  add constraint wl_set_ck check (set_number between 1 and 50),
  add constraint wl_note_ck check (note is null or length(note) <= 500),
  add constraint wl_name_ck check (length(exercise_name) between 1 and 200);

drop policy if exists wl_write on public.workout_logs;
create policy wl_insert on public.workout_logs for insert to authenticated
  with check (user_id = (select auth.uid())
    and performed_on between current_date - 60 and current_date + 1
    and (plan_item_id is null or exists (
      select 1 from public.workout_plan_items i join public.workout_plans p on p.id = i.plan_id
      where i.id = plan_item_id and p.user_id = (select auth.uid()))));
create policy wl_delete on public.workout_logs for delete to authenticated using (user_id = (select auth.uid()));
-- niente update: per correggere il cliente cancella e riscrive le serie del giorno
revoke update on public.workout_logs from authenticated, anon;

-- ===== Record personali (calcolati dal database, non scrivibili dal cliente) =====
create table public.personal_records (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_key text not null,
  exercise_name text not null,
  weight_kg numeric(6,2) not null,
  previous_kg numeric(6,2),
  achieved_on date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_key, achieved_on)
);
alter table public.personal_records enable row level security;
create policy pr_select on public.personal_records for select to authenticated using (private.can_view_client(user_id));
create policy require_approved on public.personal_records as restrictive for all to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));
revoke insert, update, delete on public.personal_records from authenticated, anon;
grant select on public.personal_records to authenticated;

-- ===== Traguardi =====
create table public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  earned_at timestamptz not null default now(),
  primary key (user_id, code)
);
alter table public.user_badges enable row level security;
create policy badges_select on public.user_badges for select to authenticated using (private.can_view_client(user_id));
create policy require_approved on public.user_badges as restrictive for all to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));
revoke insert, update, delete on public.user_badges from authenticated, anon;
grant select on public.user_badges to authenticated;

create or replace function private.badge_title(p_code text)
returns text language sql immutable set search_path = '' as $$
  select case p_code
    when 'ingressi_1' then 'Primo round'
    when 'ingressi_10' then 'Dieci riprese'
    when 'ingressi_25' then 'Peso medio'
    when 'ingressi_50' then 'Peso massimo'
    when 'ingressi_100' then 'Campione'
    when 'ingressi_200' then 'Leggenda della palestra'
    when 'costanza_4' then 'Occhio della tigre'
    when 'diario_1' then 'Primo allenamento segnato'
    when 'diario_20' then 'Diario di ferro'
    when 'record_1' then 'Primo record'
    when 'record_10' then 'Cintura d''oro'
    when 'misure_1' then 'Si parte'
    else p_code end
$$;

create or replace function private.award_badge(p_user uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_badges (user_id, code) values (p_user, p_code) on conflict do nothing;
  if found then
    perform private.notify(p_user, 'Nuovo traguardo: ' || private.badge_title(p_code) || ' 🏅',
      'Lo trovi in Allenamento → Traguardi.', 'badge', '/app/allenamento?tab=traguardi', 'badge-' || p_user || '-' || p_code);
  end if;
end $$;

-- ingressi e costanza (4 settimane di fila con almeno 2 ingressi)
create or replace function private.badges_on_checkin()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n int; weeks int;
begin
  if not new.allowed then return new; end if;
  select count(*) into n from public.checkins where user_id = new.user_id and allowed;
  if n >= 1 then perform private.award_badge(new.user_id, 'ingressi_1'); end if;
  if n >= 10 then perform private.award_badge(new.user_id, 'ingressi_10'); end if;
  if n >= 25 then perform private.award_badge(new.user_id, 'ingressi_25'); end if;
  if n >= 50 then perform private.award_badge(new.user_id, 'ingressi_50'); end if;
  if n >= 100 then perform private.award_badge(new.user_id, 'ingressi_100'); end if;
  if n >= 200 then perform private.award_badge(new.user_id, 'ingressi_200'); end if;
  select count(*) into weeks from (
    select date_trunc('week', c.checked_at at time zone 'Europe/Rome') w from public.checkins c
    where c.user_id = new.user_id and c.allowed
      and (c.checked_at at time zone 'Europe/Rome') >= date_trunc('week', now() at time zone 'Europe/Rome') - interval '3 weeks'
    group by 1 having count(*) >= 2) x;
  if weeks >= 4 then perform private.award_badge(new.user_id, 'costanza_4'); end if;
  return new;
end $$;
create trigger badges_on_checkin after insert on public.checkins for each row execute function private.badges_on_checkin();

create or replace function private.badges_on_measure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.award_badge(new.user_id, 'misure_1');
  return new;
end $$;
create trigger badges_on_measure after insert on public.measurements for each row execute function private.badges_on_measure();

-- diario: record personali + traguardi, una volta per salvataggio (non per ogni serie)
create or replace function private.on_workout_logs()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; prev numeric; days int; recs int; nm text;
begin
  for r in select l.user_id, lower(trim(l.exercise_name)) k, min(l.exercise_name) name, l.performed_on d, max(l.weight_kg) w
           from new_rows l where l.weight_kg is not null and l.weight_kg > 0
           group by l.user_id, lower(trim(l.exercise_name)), l.performed_on loop
    select max(weight_kg) into prev from public.workout_logs
     where user_id = r.user_id and lower(trim(exercise_name)) = r.k and performed_on < r.d;
    if prev is not null and r.w > prev then
      insert into public.personal_records (user_id, exercise_key, exercise_name, weight_kg, previous_kg, achieved_on)
      values (r.user_id, r.k, r.name, r.w, prev, r.d)
      on conflict (user_id, exercise_key, achieved_on) do update set weight_kg = excluded.weight_kg, exercise_name = excluded.exercise_name;
      perform private.notify(r.user_id, 'Nuovo record personale 🏆',
        r.name || ': ' || trim(to_char(r.w, 'FM99990.##')) || ' kg (prima ' || trim(to_char(prev, 'FM99990.##')) || ' kg)',
        'record', '/app/allenamento?tab=progressi', 'pr-' || r.user_id || '-' || md5(r.k) || '-' || r.d);
      select trim(first_name || ' ' || last_name) into nm from public.profiles where id = r.user_id;
      perform private.notify(c, 'Record di ' || coalesce(nm, 'un cliente') || ' 🏆',
        r.name || ': ' || trim(to_char(r.w, 'FM99990.##')) || ' kg', 'record', '/staff/clienti/' || r.user_id,
        'pr-staff-' || c || '-' || r.user_id || '-' || md5(r.k) || '-' || r.d)
      from private.coaches_of(r.user_id) c;
    end if;
  end loop;

  for r in select distinct l.user_id from new_rows l loop
    perform private.award_badge(r.user_id, 'diario_1');
    select count(distinct performed_on) into days from public.workout_logs where user_id = r.user_id;
    if days >= 20 then perform private.award_badge(r.user_id, 'diario_20'); end if;
    select count(*) into recs from public.personal_records where user_id = r.user_id;
    if recs >= 1 then perform private.award_badge(r.user_id, 'record_1'); end if;
    if recs >= 10 then perform private.award_badge(r.user_id, 'record_10'); end if;
  end loop;
  return null;
end $$;
create trigger on_workout_logs after insert on public.workout_logs
  referencing new table as new_rows for each statement execute function private.on_workout_logs();

-- se il cliente cancella le serie di un giorno, il record di quel giorno sparisce con loro
create or replace function private.on_workout_logs_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.personal_records pr using (select distinct user_id, lower(trim(exercise_name)) k, performed_on d from old_rows) o
   where pr.user_id = o.user_id and pr.exercise_key = o.k and pr.achieved_on = o.d
     and not exists (select 1 from public.workout_logs l where l.user_id = o.user_id
                     and lower(trim(l.exercise_name)) = o.k and l.performed_on = o.d and l.weight_kg >= pr.weight_kg);
  return null;
end $$;
create trigger on_workout_logs_delete after delete on public.workout_logs
  referencing old table as old_rows for each statement execute function private.on_workout_logs_delete();

-- ===== Foto progressi: private, il cliente può condividerle con il suo trainer =====
alter table public.progress_photos
  add column if not exists shared_with_coach boolean not null default false,
  add constraint photos_note_ck check (note is null or length(note) <= 300);

drop policy if exists photos_own on public.progress_photos;
create policy photos_select on public.progress_photos for select to authenticated
  using (user_id = (select auth.uid()) or (shared_with_coach and private.can_coach(user_id)));
create policy photos_insert on public.progress_photos for insert to authenticated
  with check (user_id = (select auth.uid()) and file_path like (select auth.uid())::text || '/%'
    and taken_on between current_date - 3650 and current_date + 1);
create policy photos_update on public.progress_photos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and taken_on <= current_date + 1);
create policy photos_delete on public.progress_photos for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.progress_photos from authenticated, anon;
grant update (shared_with_coach, taken_on, note) on public.progress_photos to authenticated;

-- il file nello storage: lo legge il trainer (o l'admin) solo se il cliente l'ha condiviso
create policy progress_coach_select on storage.objects for select to authenticated
  using (bucket_id = 'progress' and exists (
    select 1 from public.progress_photos p
    where p.file_path = name and p.shared_with_coach and private.can_coach(p.user_id)));

-- ===== Messaggi =====
-- notifica con il link diretto alla conversazione giusta (cliente o staff)
create or replace function private.on_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n text; rrole public.user_role;
begin
  select trim(first_name || ' ' || last_name) into n from public.profiles where id = new.sender_id;
  select role into rrole from public.profiles where id = new.recipient_id;
  perform private.notify(new.recipient_id, 'Messaggio da ' || coalesce(n, 'OldSchool Gym'), left(new.body, 120), 'message',
    case when rrole = 'client' then '/app/messaggi?con=' else '/staff/messaggi?con=' end || new.sender_id);
  return new;
end $$;

-- limite anti-spam: al massimo 20 messaggi al minuto per persona
create or replace function private.message_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.messages where sender_id = new.sender_id and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'Stai scrivendo troppo in fretta: aspetta un minuto';
  end if;
  return new;
end $$;
create trigger message_rate_limit before insert on public.messages for each row execute function private.message_rate_limit();

-- elenco conversazioni con ultimo messaggio e non letti
create or replace function public.my_conversations()
returns table (peer_id uuid, last_body text, last_at timestamptz, last_mine boolean, unread int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select case when m.sender_id = (select auth.uid()) then m.recipient_id else m.sender_id end as peer, m.*
    from public.messages m
    where (select private.is_approved()) and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
  )
  select peer, (array_agg(body order by created_at desc))[1], max(created_at),
         (array_agg(sender_id = (select auth.uid()) order by created_at desc))[1],
         count(*) filter (where recipient_id = (select auth.uid()) and read_at is null)::int
  from mine group by peer order by max(created_at) desc
$$;

-- ===== Da seguire: lista per lo staff (assenti, schede vecchie, ingressi finiti) =====
create or replace function public.staff_followups()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inact int; weeks int;
begin
  if not private.is_staff() or not private.is_approved() then raise exception 'Non autorizzato'; end if;
  select inactivity_days, plan_change_weeks into inact, weeks from public.gym_settings where id = 1;
  return jsonb_build_object(
    'absence_days', inact,
    'plan_weeks', weeks,
    'absent', (select coalesce(jsonb_agg(x order by x.days desc), '[]'::jsonb) from (
      select p.id, p.first_name, p.last_name, p.avatar_url,
             (current_date - coalesce((select max(c.checked_at) from public.checkins c where c.user_id = p.id and c.allowed), p.created_at)::date) as days,
             exists (select 1 from public.checkins c where c.user_id = p.id and c.allowed) as ever
      from public.profiles p
      where p.role = 'client' and p.is_active and private.is_approved(p.id) and private.can_view_client(p.id)
        and (private.active_membership(p.id)).id is not null
        and coalesce((select max(c.checked_at) from public.checkins c where c.user_id = p.id and c.allowed), p.created_at) < now() - make_interval(days => inact)
      limit 50) x),
    'plans', (select coalesce(jsonb_agg(x order by x.weeks desc), '[]'::jsonb) from (
      select w.id as plan_id, p.id, p.first_name, p.last_name, p.avatar_url, w.title,
             ((current_date - coalesce(w.starts_on, w.created_at::date)) / 7) as weeks
      from public.workout_plans w join public.profiles p on p.id = w.user_id
      where w.is_active and not w.is_template and p.is_active and p.role = 'client' and private.can_view_client(p.id)
        and coalesce(w.starts_on, w.created_at::date) <= current_date - weeks * 7
        and (w.ends_on is null or w.ends_on >= current_date)
        and not exists (select 1 from public.workout_plans w2 where w2.user_id = w.user_id and w2.is_active and not w2.is_template
                        and coalesce(w2.starts_on, w2.created_at::date) > coalesce(w.starts_on, w.created_at::date))
      limit 50) x),
    'entries', (select coalesce(jsonb_agg(x order by x.entries_left), '[]'::jsonb) from (
      select p.id, p.first_name, p.last_name, p.avatar_url, m.entries_left, m.plan_name
      from public.memberships m join public.profiles p on p.id = m.user_id
      where m.status = 'active' and m.entries_left is not null and m.entries_left <= 2
        and (m.end_date is null or m.end_date >= current_date) and p.is_active and private.can_view_client(p.id)
        and not exists (select 1 from public.memberships m2 where m2.user_id = m.user_id and m2.id <> m.id and m2.status = 'active'
                        and (m2.end_date is null or m2.end_date >= current_date) and coalesce(m2.entries_left, 1) > 0
                        and m2.start_date >= m.start_date)
      limit 50) x)
  );
end $$;

-- ===== Promemoria automatici (cron ogni ora): quelli di prima + i nuovi =====
create or replace function private.run_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare r record; inact int; weeks int; daytime boolean;
begin
  update public.memberships set status = 'expired'
    where status = 'active' and end_date < current_date;

  for r in select m.user_id, m.end_date, m.plan_name from public.memberships m
           where m.status = 'active' and m.end_date in (current_date + 7, current_date + 1) loop
    perform private.notify(r.user_id, 'Abbonamento in scadenza ⏰',
      'Il tuo ' || r.plan_name || ' scade il ' || to_char(r.end_date, 'DD/MM') || '. Rinnovalo in reception!',
      'membership', '/app/abbonamento', 'exp-' || r.user_id || '-' || r.end_date || '-' || (r.end_date - current_date));
  end loop;

  for r in select c.user_id, c.expires_on from public.medical_certificates c
           where c.expires_on in (current_date + 30, current_date + 7, current_date) loop
    perform private.notify(r.user_id, 'Certificato medico in scadenza 🩺',
      'Il certificato scade il ' || to_char(r.expires_on, 'DD/MM/YYYY') || '. Caricane uno nuovo dal profilo.',
      'certificate', '/app/profilo', 'cert-' || r.user_id || '-' || r.expires_on || '-' || (r.expires_on - current_date));
  end loop;

  for r in select p.id, p.first_name from public.profiles p
           where p.birth_date is not null and to_char(p.birth_date, 'MM-DD') = to_char(current_date, 'MM-DD') loop
    perform private.notify(r.id, 'Buon compleanno ' || r.first_name || '! 🎂',
      'Tutta la squadra OldSchool ti fa gli auguri. Passa in reception: c''è una sorpresa.',
      'birthday', '/app', 'bday-' || r.id || '-' || extract(year from current_date));
  end loop;

  for r in select b.user_id, s.id, s.title, s.starts_at from public.bookings b join public.sessions s on s.id = b.session_id
           where b.status = 'booked' and not s.is_cancelled and s.starts_at between now() + interval '1 hour' and now() + interval '3 hours' loop
    perform private.notify(r.user_id, 'Lezione tra poco 💪',
      r.title || ' alle ' || to_char(r.starts_at at time zone 'Europe/Rome', 'HH24:MI') || '. Ti aspettiamo!',
      'reminder', '/app/calendario', 'rem-' || r.user_id || '-' || r.id);
  end loop;

  -- solleciti pagamenti scaduti
  for r in select p.user_id, p.id, p.amount_cents, p.due_date from public.payments p
           where p.status = 'pending' and p.due_date is not null and p.due_date <= current_date loop
    perform private.notify(r.user_id, 'Pagamento in sospeso',
      'Hai un pagamento di € ' || to_char(r.amount_cents / 100.0, 'FM999990.00') || ' scaduto il ' || to_char(r.due_date, 'DD/MM') || '.',
      'payment', '/app/abbonamento', 'pay-' || r.id || '-' || current_date);
  end loop;

  -- no-show: lezioni passate senza presenza
  update public.bookings b set status = 'no_show', updated_at = now()
    from public.sessions s
    where b.session_id = s.id and b.status = 'booked' and s.ends_at < now() - interval '1 hour';

  -- ----- nuovi avvisi: solo di giorno (9-20 ora italiana), per non svegliare nessuno con le notifiche -----
  daytime := extract(hour from now() at time zone 'Europe/Rome') between 9 and 19;
  if not daytime then return; end if;
  select inactivity_days, plan_change_weeks into inact, weeks from public.gym_settings where id = 1;

  -- ingressi in esaurimento (2, 1, finiti), se non c'è già un altro abbonamento valido
  for r in select m.id, m.user_id, m.entries_left, m.plan_name from public.memberships m join public.profiles p on p.id = m.user_id
           where m.status = 'active' and m.entries_left is not null and m.entries_left <= 2
             and (m.end_date is null or m.end_date >= current_date) and p.is_active
             and not exists (select 1 from public.memberships m2 where m2.user_id = m.user_id and m2.id <> m.id and m2.status = 'active'
                             and (m2.end_date is null or m2.end_date >= current_date) and coalesce(m2.entries_left, 1) > 0
                             and m2.start_date >= m.start_date) loop
    perform private.notify(r.user_id,
      case when r.entries_left = 0 then 'Ingressi finiti 🥊' when r.entries_left = 1 then 'Ti resta 1 ingresso' else 'Ti restano 2 ingressi' end,
      case when r.entries_left = 0 then 'Il tuo ' || r.plan_name || ' è finito. Rinnovalo in reception per continuare ad allenarti.'
           else 'Il tuo ' || r.plan_name || ' sta per finire. Rinnovalo in reception quando vuoi.' end,
      'membership', '/app/abbonamento', 'entries-' || r.id || '-' || r.entries_left);
  end loop;

  -- clienti che non vengono da N giorni (impostazioni, 10 di default): avviso al cliente e a chi lo segue
  for r in select p.id, p.first_name, p.last_name, x.last_at
           from public.profiles p
           cross join lateral (select coalesce((select max(c.checked_at) from public.checkins c where c.user_id = p.id and c.allowed), p.created_at) as last_at) x
           where p.role = 'client' and p.is_active and private.is_approved(p.id)
             and (private.active_membership(p.id)).id is not null
             and x.last_at < now() - make_interval(days => inact)
             and x.last_at > now() - interval '120 days' loop
    perform private.notify(r.id, 'Ci manchi, ' || r.first_name || '! 🥊',
      'Non ti vediamo da ' || (current_date - r.last_at::date) || ' giorni. Il sacco ti aspetta: passa quando vuoi.',
      'absence', '/app', 'absent-' || r.id || '-' || r.last_at::date);
    perform private.notify(c, 'Da richiamare: ' || trim(r.first_name || ' ' || r.last_name),
      'Non viene da ' || (current_date - r.last_at::date) || ' giorni.', 'followup', '/staff/clienti/' || r.id,
      'absent-staff-' || c || '-' || r.id || '-' || r.last_at::date)
    from private.coaches_of(r.id) c;
  end loop;

  -- cambio scheda: allo staff dopo N settimane (6 di default), al cliente 2 settimane dopo
  for r in select w.id, w.user_id, w.title, coalesce(w.starts_on, w.created_at::date) as since, p.first_name, p.last_name
           from public.workout_plans w join public.profiles p on p.id = w.user_id
           where w.is_active and not w.is_template and p.is_active and p.role = 'client' and private.is_approved(p.id)
             and coalesce(w.starts_on, w.created_at::date) <= current_date - weeks * 7
             and (w.ends_on is null or w.ends_on >= current_date)
             and not exists (select 1 from public.workout_plans w2 where w2.user_id = w.user_id and w2.is_active and not w2.is_template
                             and coalesce(w2.starts_on, w2.created_at::date) > coalesce(w.starts_on, w.created_at::date)) loop
    perform private.notify(c, 'È ora di cambiare scheda 📋',
      trim(r.first_name || ' ' || r.last_name) || ' usa "' || r.title || '" da ' || ((current_date - r.since) / 7) || ' settimane.',
      'plan_change', '/staff/clienti/' || r.user_id, 'plan-staff-' || c || '-' || r.id)
    from private.coaches_of(r.user_id) c;
    if r.since <= current_date - (weeks + 2) * 7 then
      perform private.notify(r.user_id, 'La tua scheda ha ' || ((current_date - r.since) / 7) || ' settimane',
        'Chiedi al trainer di aggiornarla: cambiare stimoli aiuta a progredire.', 'plan_change', '/app/messaggi', 'plan-client-' || r.id);
    end if;
  end loop;
end $$;

-- ===== GDPR: l'export include anche record e traguardi =====
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'qr_token' from public.profiles p where p.id = (select auth.uid())),
    'memberships', (select coalesce(jsonb_agg(m), '[]') from public.memberships m where m.user_id = (select auth.uid())),
    'payments', (select coalesce(jsonb_agg(x), '[]') from public.payments x where x.user_id = (select auth.uid())),
    'certificates', (select coalesce(jsonb_agg(x), '[]') from public.medical_certificates x where x.user_id = (select auth.uid())),
    'bookings', (select coalesce(jsonb_agg(x), '[]') from public.bookings x where x.user_id = (select auth.uid())),
    'checkins', (select coalesce(jsonb_agg(x), '[]') from public.checkins x where x.user_id = (select auth.uid())),
    'workout_plans', (select coalesce(jsonb_agg(x), '[]') from public.workout_plans x where x.user_id = (select auth.uid())),
    'workout_logs', (select coalesce(jsonb_agg(x), '[]') from public.workout_logs x where x.user_id = (select auth.uid())),
    'personal_records', (select coalesce(jsonb_agg(x), '[]') from public.personal_records x where x.user_id = (select auth.uid())),
    'badges', (select coalesce(jsonb_agg(x), '[]') from public.user_badges x where x.user_id = (select auth.uid())),
    'measurements', (select coalesce(jsonb_agg(x), '[]') from public.measurements x where x.user_id = (select auth.uid())),
    'goals', (select coalesce(jsonb_agg(x), '[]') from public.goals x where x.user_id = (select auth.uid())),
    'progress_photos', (select coalesce(jsonb_agg(x), '[]') from public.progress_photos x where x.user_id = (select auth.uid())),
    'messages', (select coalesce(jsonb_agg(x), '[]') from public.messages x where x.sender_id = (select auth.uid()) or x.recipient_id = (select auth.uid())),
    'notifications', (select coalesce(jsonb_agg(x), '[]') from public.notifications x where x.user_id = (select auth.uid()))
  )
$$;

-- ===== Permessi sulle funzioni =====
revoke execute on function private.coaches_of(uuid), private.badge_title(text), private.award_badge(uuid, text),
  private.badges_on_checkin(), private.badges_on_measure(), private.on_workout_logs(), private.on_workout_logs_delete(),
  private.message_rate_limit(), private.on_new_message(), private.run_reminders() from public, anon, authenticated;
revoke execute on function public.my_conversations(), public.staff_followups(), public.export_my_data() from public, anon;
grant execute on function public.my_conversations(), public.staff_followups(), public.export_my_data() to authenticated;

-- ===== Traguardi già maturati da chi è iscritto (ingressi e misure fatte prima di oggi) =====
insert into public.user_badges (user_id, code)
select user_id, code from (
  select c.user_id, unnest(array_remove(array[
    'ingressi_1',
    case when count(*) >= 10 then 'ingressi_10' end, case when count(*) >= 25 then 'ingressi_25' end,
    case when count(*) >= 50 then 'ingressi_50' end, case when count(*) >= 100 then 'ingressi_100' end,
    case when count(*) >= 200 then 'ingressi_200' end], null)) code
  from public.checkins c where c.allowed group by c.user_id
  union all
  select distinct user_id, 'misure_1' from public.measurements
) b
on conflict do nothing;
