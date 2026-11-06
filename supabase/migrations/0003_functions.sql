-- OldSchool Gym: funzioni applicative (RPC)

-- Abbonamento valido per una data
create or replace function private.active_membership(p_user uuid, p_day date default current_date)
returns public.memberships language sql stable security definer set search_path = '' as $$
  select m.* from public.memberships m
  where m.user_id = p_user and m.status = 'active'
    and m.start_date <= p_day
    and (m.end_date is null or m.end_date >= p_day)
    and (m.entries_left is null or m.entries_left > 0)
    and not (m.suspended_from is not null and p_day between m.suspended_from and coalesce(m.suspended_to, m.suspended_from))
  order by m.end_date desc nulls last
  limit 1
$$;

create or replace function private.notify(p_user uuid, p_title text, p_body text, p_kind text, p_link text, p_key text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, title, body, kind, link, dedupe_key)
  values (p_user, p_title, p_body, p_kind, p_link, p_key)
  on conflict (dedupe_key) do nothing
$$;

-- Elenco staff visibile ai clienti (solo dati pubblici)
create or replace function public.get_staff()
returns table (id uuid, first_name text, last_name text, role public.user_role, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.role, p.avatar_url
  from public.profiles p
  where p.role in ('admin','trainer') and p.is_active and (select auth.uid()) is not null
  order by p.role desc, p.first_name
$$;

-- Sessioni in un intervallo con conteggi e stato della mia prenotazione
create or replace function public.get_sessions(p_from timestamptz, p_to timestamptz)
returns table (
  id uuid, course_id uuid, kind public.session_kind, title text, description text,
  starts_at timestamptz, ends_at timestamptz, capacity int, room text, is_cancelled boolean,
  trainer_id uuid, trainer_name text, color text, booked_count int, waitlist_count int,
  my_status public.booking_status
) language sql stable security definer set search_path = '' as $$
  select s.id, s.course_id, s.kind, s.title, s.description, s.starts_at, s.ends_at, s.capacity, s.room, s.is_cancelled,
    s.trainer_id, nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')), ''),
    coalesce(c.color, case s.kind when 'event' then '#E8553D' else '#F5C518' end),
    (select count(*)::int from public.bookings b where b.session_id = s.id and b.status in ('booked','attended')),
    (select count(*)::int from public.bookings b where b.session_id = s.id and b.status = 'waitlist'),
    (select b.status from public.bookings b where b.session_id = s.id and b.user_id = (select auth.uid()))
  from public.sessions s
  left join public.courses c on c.id = s.course_id
  left join public.profiles t on t.id = s.trainer_id
  where s.starts_at >= p_from and s.starts_at < p_to
    and (p_to - p_from) <= interval '62 days'
  order by s.starts_at
$$;

-- Prenota una sessione (o entra in lista d'attesa)
create or replace function public.book_session(p_session uuid)
returns public.booking_status language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.sessions;
  booked int;
  result public.booking_status;
  m public.memberships;
begin
  if uid is null then raise exception 'Devi effettuare l''accesso'; end if;
  select * into s from public.sessions where id = p_session for update;
  if not found or s.is_cancelled then raise exception 'Lezione non disponibile'; end if;
  if s.starts_at < now() then raise exception 'La lezione è già iniziata'; end if;
  if exists (select 1 from public.closures where day = (s.starts_at at time zone 'Europe/Rome')::date) then
    raise exception 'La palestra è chiusa quel giorno';
  end if;
  m := private.active_membership(uid, (s.starts_at at time zone 'Europe/Rome')::date);
  if m.id is null then raise exception 'Serve un abbonamento attivo per prenotare'; end if;

  if exists (select 1 from public.bookings where session_id = p_session and user_id = uid and status in ('booked','waitlist','attended')) then
    raise exception 'Sei già prenotato';
  end if;

  select count(*) into booked from public.bookings where session_id = p_session and status in ('booked','attended');
  result := case when booked < s.capacity then 'booked'::public.booking_status else 'waitlist'::public.booking_status end;

  insert into public.bookings (session_id, user_id, status) values (p_session, uid, result)
  on conflict (session_id, user_id) do update set status = excluded.status, created_at = now(), updated_at = now();

  perform private.notify(uid,
    case when result = 'booked' then 'Prenotazione confermata ✅' else 'Sei in lista d''attesa ⏳' end,
    s.title || ' · ' || to_char(s.starts_at at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
    'booking', '/app/calendario');
  return result;
end $$;

-- Disdici (rispettando la regola delle ore) e promuovi la lista d'attesa
create or replace function public.cancel_booking(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.sessions;
  hrs int;
  prev public.booking_status;
  nxt record;
begin
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'Lezione non trovata'; end if;
  select status into prev from public.bookings where session_id = p_session and user_id = uid;
  if prev is null or prev not in ('booked','waitlist') then raise exception 'Nessuna prenotazione da disdire'; end if;
  select cancel_hours into hrs from public.gym_settings where id = 1;
  if prev = 'booked' and s.starts_at - make_interval(hours => hrs) < now() then
    raise exception 'Puoi disdire fino a % ore prima dell''inizio', hrs;
  end if;
  update public.bookings set status = 'cancelled', updated_at = now() where session_id = p_session and user_id = uid;

  if prev = 'booked' then
    select b.id, b.user_id into nxt from public.bookings b
      where b.session_id = p_session and b.status = 'waitlist' order by b.created_at limit 1 for update;
    if nxt.id is not null then
      update public.bookings set status = 'booked', updated_at = now() where id = nxt.id;
      perform private.notify(nxt.user_id, 'Si è liberato un posto! 🎉',
        'Sei passato dalla lista d''attesa a prenotato: ' || s.title || ' · ' || to_char(s.starts_at at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
        'waitlist', '/app/calendario');
    end if;
  end if;
end $$;

-- Check-in tramite QR (solo staff)
create or replace function public.checkin(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  m public.memberships;
  cert_ok boolean;
  need_cert boolean;
  ok boolean := true;
  why text := null;
begin
  if not private.is_staff() then raise exception 'Non autorizzato'; end if;
  select * into p from public.profiles where qr_token = p_token;
  if not found then
    return jsonb_build_object('found', false, 'allowed', false, 'reason', 'QR non riconosciuto');
  end if;
  m := private.active_membership(p.id);
  select block_without_certificate into need_cert from public.gym_settings where id = 1;
  cert_ok := exists (select 1 from public.medical_certificates c where c.user_id = p.id and c.expires_on >= current_date);

  if not p.is_active then ok := false; why := 'Account disattivato';
  elsif m.id is null then ok := false; why := 'Abbonamento scaduto o assente';
  elsif need_cert and not cert_ok then ok := false; why := 'Certificato medico mancante o scaduto';
  end if;

  if ok and exists (select 1 from public.checkins where user_id = p.id and allowed and checked_at > now() - interval '3 hours') then
    return jsonb_build_object('found', true, 'allowed', true, 'duplicate', true,
      'name', p.first_name || ' ' || p.last_name, 'avatar_url', p.avatar_url,
      'plan', m.plan_name, 'end_date', m.end_date, 'entries_left', m.entries_left, 'reason', 'Ingresso già registrato');
  end if;

  insert into public.checkins (user_id, allowed, reason, staff_id) values (p.id, ok, why, (select auth.uid()));
  if ok and m.entries_left is not null then
    update public.memberships set entries_left = entries_left - 1 where id = m.id returning * into m;
  end if;
  if ok then
    -- segna presente alle lezioni di oggi
    update public.bookings b set status = 'attended', updated_at = now()
      from public.sessions s
      where b.session_id = s.id and b.user_id = p.id and b.status = 'booked'
        and s.starts_at between now() - interval '1 hour' and now() + interval '2 hours';
  end if;
  return jsonb_build_object('found', true, 'allowed', ok, 'reason', why,
    'name', p.first_name || ' ' || p.last_name, 'avatar_url', p.avatar_url,
    'plan', m.plan_name, 'end_date', m.end_date, 'entries_left', m.entries_left, 'certificate_ok', cert_ok);
end $$;

-- Dashboard admin
create or replace function public.admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare res jsonb; inact int;
begin
  if not private.is_staff() then raise exception 'Non autorizzato'; end if;
  select inactivity_days into inact from public.gym_settings where id = 1;
  select jsonb_build_object(
    'active_members', (select count(distinct m.user_id) from public.memberships m where m.status = 'active' and (m.end_date is null or m.end_date >= current_date)),
    'total_clients', (select count(*) from public.profiles where role = 'client'),
    'checkins_today', (select count(*) from public.checkins where allowed and checked_at >= date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'),
    'in_gym_now', (select count(distinct user_id) from public.checkins where allowed and checked_at > now() - interval '90 minutes'),
    'revenue_month_cents', case when private.is_front() then (select coalesce(sum(amount_cents),0) from public.payments where status = 'paid' and paid_at >= date_trunc('month', now()))
      + (select coalesce(sum(total_cents),0) from public.sales where created_at >= date_trunc('month', now())) else null end,
    'pending_payments_cents', case when private.is_front() then (select coalesce(sum(amount_cents),0) from public.payments where status = 'pending') else null end,
    'expiring_7d', (select count(*) from public.memberships where status = 'active' and end_date between current_date and current_date + 7),
    'certs_expiring_30d', (select count(*) from public.medical_certificates c where c.expires_on between current_date and current_date + 30),
    'new_leads', (select count(*) from public.leads where status = 'new'),
    'at_risk', (select count(*) from public.profiles p where p.role = 'client' and p.is_active
        and (private.active_membership(p.id)).id is not null
        and not exists (select 1 from public.checkins c where c.user_id = p.id and c.checked_at > now() - make_interval(days => inact))),
    'today_sessions', (select coalesce(jsonb_agg(x order by x.starts_at), '[]'::jsonb) from (
        select s.id, s.title, s.starts_at, s.capacity,
          (select count(*) from public.bookings b where b.session_id = s.id and b.status in ('booked','attended')) as booked
        from public.sessions s
        where not s.is_cancelled and (s.starts_at at time zone 'Europe/Rome')::date = (now() at time zone 'Europe/Rome')::date) x),
    'checkins_week', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
        select d::date as day, (select count(*) from public.checkins c where c.allowed and (c.checked_at at time zone 'Europe/Rome')::date = d::date) as n
        from generate_series(current_date - 6, current_date, interval '1 day') d) x)
  ) into res;
  return res;
end $$;

-- Statistiche
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inact int;
begin
  if not private.is_front() then raise exception 'Non autorizzato'; end if;
  select inactivity_days into inact from public.gym_settings where id = 1;
  return jsonb_build_object(
    'by_hour', (select coalesce(jsonb_agg(x order by x.h), '[]'::jsonb) from (
       select h, (select count(*) from public.checkins c where c.allowed and c.checked_at > now() - interval '30 days'
                  and extract(hour from c.checked_at at time zone 'Europe/Rome') = h) as n
       from generate_series(6, 22) h) x),
    'by_weekday', (select coalesce(jsonb_agg(x order by x.d), '[]'::jsonb) from (
       select d, (select count(*) from public.checkins c where c.allowed and c.checked_at > now() - interval '60 days'
                  and extract(isodow from c.checked_at at time zone 'Europe/Rome') = d) as n
       from generate_series(1, 7) d) x),
    'top_courses', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
       select s.title, count(*) as n from public.bookings b join public.sessions s on s.id = b.session_id
       where b.status in ('booked','attended') and s.starts_at > now() - interval '60 days'
       group by s.title order by n desc limit 6) x),
    'revenue_months', (select coalesce(jsonb_agg(x order by x.m), '[]'::jsonb) from (
       select to_char(d, 'YYYY-MM') as m,
         (select coalesce(sum(amount_cents),0) from public.payments p where p.status = 'paid' and date_trunc('month', p.paid_at) = d) as cents
       from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') d) x),
    'renewal_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where renewed) / count(*)) end from (
       select exists (select 1 from public.memberships m2 where m2.user_id = m.user_id and m2.start_date > m.start_date) as renewed
       from public.memberships m where m.end_date between current_date - 90 and current_date) r),
    'no_show_rate', (select case when count(*) = 0 then null else round(100.0 * count(*) filter (where b.status = 'no_show') / count(*)) end
       from public.bookings b join public.sessions s on s.id = b.session_id
       where s.starts_at between now() - interval '60 days' and now() and b.status in ('attended','no_show','booked')),
    'at_risk_clients', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
       select p.id, p.first_name, p.last_name, p.phone,
         (select max(c.checked_at) from public.checkins c where c.user_id = p.id and c.allowed) as last_checkin
       from public.profiles p
       where p.role = 'client' and p.is_active and (private.active_membership(p.id)).id is not null
         and not exists (select 1 from public.checkins c where c.user_id = p.id and c.checked_at > now() - make_interval(days => inact))
       order by last_checkin nulls first limit 30) x)
  );
end $$;

-- Affluenza in tempo reale (per i clienti)
create or replace function public.gym_occupancy()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'now', (select count(distinct user_id) from public.checkins where allowed and checked_at > now() - interval '90 minutes'),
    'capacity', (select max_capacity from public.gym_settings where id = 1),
    'by_hour', (select coalesce(jsonb_agg(x order by x.h), '[]'::jsonb) from (
       select h, round((select count(*) from public.checkins c where c.allowed and c.checked_at > now() - interval '28 days'
                  and extract(isodow from c.checked_at at time zone 'Europe/Rome') = extract(isodow from now() at time zone 'Europe/Rome')
                  and extract(hour from c.checked_at at time zone 'Europe/Rome') = h) / 4.0, 1) as n
       from generate_series(6, 22) h) x)
  ) where (select auth.uid()) is not null
$$;

-- Comunicazione a gruppi (crea notifiche in-app)
create or replace function public.broadcast(p_title text, p_body text, p_target text default 'all', p_link text default '/app/news')
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_front() then raise exception 'Non autorizzato'; end if;
  insert into public.notifications (user_id, title, body, kind, link)
  select p.id, left(p_title, 140), left(p_body, 2000), 'broadcast', p_link
  from public.profiles p
  where p.is_active and case p_target
    when 'all' then true
    when 'clients' then p.role = 'client'
    when 'staff' then p.role <> 'client'
    when 'active' then p.role = 'client' and (private.active_membership(p.id)).id is not null
    when 'expired' then p.role = 'client' and (private.active_membership(p.id)).id is null
    when 'marketing' then p.role = 'client' and p.consent_marketing
    else false end;
  get diagnostics n = row_count;
  return n;
end $$;

-- GDPR: esporta i miei dati
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
    'measurements', (select coalesce(jsonb_agg(x), '[]') from public.measurements x where x.user_id = (select auth.uid())),
    'goals', (select coalesce(jsonb_agg(x), '[]') from public.goals x where x.user_id = (select auth.uid())),
    'messages', (select coalesce(jsonb_agg(x), '[]') from public.messages x where x.sender_id = (select auth.uid()) or x.recipient_id = (select auth.uid())),
    'notifications', (select coalesce(jsonb_agg(x), '[]') from public.notifications x where x.user_id = (select auth.uid()))
  )
$$;

-- Promemoria automatici (eseguiti da pg_cron)
create or replace function private.run_reminders()
returns void language plpgsql security definer set search_path = '' as $$
declare r record;
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
end $$;

-- Notifica al cliente quando riceve una nuova scheda
create or replace function private.on_new_plan()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and not new.is_template then
    perform private.notify(new.user_id, 'Nuova scheda disponibile 📋', new.title, 'plan', '/app/schede');
  end if;
  return new;
end $$;
create trigger on_new_plan after insert on public.workout_plans for each row execute function private.on_new_plan();

-- Notifica quando arriva un messaggio
create or replace function private.on_new_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n text;
begin
  select trim(first_name || ' ' || last_name) into n from public.profiles where id = new.sender_id;
  perform private.notify(new.recipient_id, 'Messaggio da ' || coalesce(n, 'OldSchool Gym'), left(new.body, 120), 'message', '/app/messaggi');
  return new;
end $$;
create trigger on_new_message after insert on public.messages for each row execute function private.on_new_message();

-- Annunci → notifiche
create or replace function private.on_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  select p.id, '📣 ' || new.title, left(new.body, 140), 'news', '/app/news'
  from public.profiles p
  where p.is_active and (new.audience = 'all' or (new.audience = 'clients' and p.role = 'client') or (new.audience = 'staff' and p.role <> 'client'));
  return new;
end $$;
create trigger on_announcement after insert on public.announcements for each row execute function private.on_announcement();

-- Durata abbonamento automatica
create or replace function private.membership_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pl public.plans;
begin
  if new.plan_id is not null then
    select * into pl from public.plans where id = new.plan_id;
    if new.end_date is null and pl.duration_days is not null then
      new.end_date := new.start_date + pl.duration_days - 1;
    end if;
    if new.entries_left is null and pl.kind = 'entries' then
      new.entries_left := pl.entries;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, (select auth.uid()));
  end if;
  -- sospensione: allunga la scadenza dei giorni sospesi
  if tg_op = 'UPDATE' and new.suspended_to is not null and new.suspended_from is not null
     and (old.suspended_to is distinct from new.suspended_to or old.suspended_from is distinct from new.suspended_from)
     and new.end_date is not null then
    new.end_date := new.end_date
      - coalesce(old.suspended_to - old.suspended_from + 1, 0)
      + (new.suspended_to - new.suspended_from + 1);
  end if;
  return new;
end $$;
create trigger membership_defaults before insert or update on public.memberships for each row execute function private.membership_defaults();
