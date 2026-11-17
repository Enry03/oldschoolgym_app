-- Check-in con QR dinamico sul tablet all'ingresso (modalità kiosk)
--
-- Flusso: il tablet (nessun utente loggato, solo un segreto di dispositivo) mostra un QR
-- che cambia ogni 30 secondi ed è monouso. Il cliente lo inquadra dall'app: il server
-- verifica codice, account approvato, abbonamento, certificato e registra l'ingresso.
-- Il tablet vede solo l'esito degli ingressi fatti con i suoi QR (nome breve e foto).
--
-- Richiede la migrazione 0010_signup_approval (private.is_approved).

-- ===== Dispositivi kiosk =====
create table private.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 60),
  secret_hash bytea not null unique,           -- sha256 del segreto: il segreto in chiaro sta solo sul tablet
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_user_agent text,
  revoked_at timestamptz
);

-- Codici QR a scadenza (30 s + 10 s di tolleranza), monouso
create table private.kiosk_codes (
  code text primary key check (code ~ '^[0-9a-f]{32}$'),
  device_id uuid not null references private.kiosk_devices(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null
);
create index on private.kiosk_codes(device_id, expires_at);

-- Esiti da mostrare sul tablet (conservati 1 giorno)
create table private.kiosk_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references private.kiosk_devices(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome text not null check (outcome in ('ok','duplicate','denied')),
  created_at timestamptz not null default now()
);
create index on private.kiosk_events(device_id, id);

-- Tentativi di check-in dei clienti (limite anti abuso, conservati 1 giorno)
create table private.checkin_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index on private.checkin_attempts(user_id, created_at);

revoke all on private.kiosk_devices, private.kiosk_codes, private.kiosk_events, private.checkin_attempts
  from public, anon, authenticated;

-- Come è avvenuto il check-in
alter table public.checkins
  add column method text not null default 'staff' check (method in ('staff','kiosk')),
  add column kiosk_id uuid references private.kiosk_devices(id) on delete set null;
create index on public.checkins(kiosk_id);

-- ===== Logica comune del check-in =====
-- Unico punto in cui si decide se un ingresso è consentito (staff, manuale o tablet).
create or replace function private.do_checkin(p_user uuid, p_staff uuid, p_kiosk uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.profiles;
  m public.memberships;
  cert_ok boolean;
  need_cert boolean;
  ok boolean := true;
  why text := null;
begin
  -- serializza i check-in della stessa persona: niente doppio scalo ingressi con due richieste parallele
  perform pg_advisory_xact_lock(hashtextextended('checkin:' || p_user::text, 0));

  select * into p from public.profiles where id = p_user;
  if not found then
    return jsonb_build_object('found', false, 'allowed', false, 'reason', 'Utente non trovato');
  end if;
  m := private.active_membership(p.id);
  select block_without_certificate into need_cert from public.gym_settings where id = 1;
  cert_ok := exists (select 1 from public.medical_certificates c where c.user_id = p.id and c.verified and c.expires_on >= current_date);

  if not p.is_active then ok := false; why := 'Account disattivato';
  elsif not private.is_approved(p.id) then ok := false; why := 'Iscrizione non approvata';
  elsif m.id is null then ok := false; why := 'Abbonamento scaduto o assente';
  elsif need_cert and not cert_ok then ok := false; why := 'Certificato medico mancante, scaduto o non verificato';
  end if;

  if ok and exists (select 1 from public.checkins where user_id = p.id and allowed and checked_at > now() - interval '3 hours') then
    return jsonb_build_object('found', true, 'allowed', true, 'duplicate', true,
      'name', p.first_name || ' ' || p.last_name, 'avatar_url', p.avatar_url,
      'plan', m.plan_name, 'end_date', m.end_date, 'entries_left', m.entries_left, 'reason', 'Ingresso già registrato');
  end if;

  insert into public.checkins (user_id, allowed, reason, staff_id, method, kiosk_id)
  values (p.id, ok, why, p_staff, case when p_kiosk is null then 'staff' else 'kiosk' end, p_kiosk);
  if ok and m.entries_left is not null then
    update public.memberships set entries_left = entries_left - 1 where id = m.id and entries_left > 0 returning * into m;
  end if;
  if ok then
    update public.bookings b set status = 'attended', updated_at = now()
      from public.sessions s
      where b.session_id = s.id and b.user_id = p.id and b.status = 'booked'
        and s.starts_at between now() - interval '1 hour' and now() + interval '2 hours';
  end if;
  return jsonb_build_object('found', true, 'allowed', ok, 'duplicate', false, 'reason', why,
    'name', p.first_name || ' ' || p.last_name, 'avatar_url', p.avatar_url,
    'plan', m.plan_name, 'end_date', m.end_date, 'entries_left', m.entries_left, 'certificate_ok', cert_ok);
end $$;

-- Check-in fatto dallo staff (scanner del QR personale o ricerca manuale): ora usa la logica comune
create or replace function public.checkin(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  if not private.is_staff() or not private.is_approved() then raise exception 'Non autorizzato'; end if;
  select id into uid from public.profiles where qr_token = p_token;
  if uid is null then
    return jsonb_build_object('found', false, 'allowed', false, 'reason', 'QR non riconosciuto');
  end if;
  return private.do_checkin(uid, (select auth.uid()), null);
end $$;

-- ===== Tablet =====
create or replace function private.kiosk_device(p_secret text)
returns private.kiosk_devices language plpgsql stable security definer set search_path = '' as $$
declare d private.kiosk_devices;
begin
  if p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Tablet non autorizzato' using errcode = '28000';
  end if;
  select * into d from private.kiosk_devices
    where secret_hash = extensions.digest(p_secret, 'sha256') and revoked_at is null;
  if not found then raise exception 'Tablet non autorizzato' using errcode = '28000'; end if;
  return d;
end $$;

-- Chiamata dal tablet ogni ~1,5 s: restituisce il QR corrente e gli esiti nuovi.
-- Eseguibile senza login: l'unica credenziale è il segreto del dispositivo.
create or replace function public.kiosk_poll(p_secret text, p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  d private.kiosk_devices;
  c private.kiosk_codes;
  last_id bigint;
  ev jsonb;
begin
  d := private.kiosk_device(p_secret);
  if d.last_seen_at is null or d.last_seen_at < now() - interval '1 minute' then
    update private.kiosk_devices
      set last_seen_at = now(),
          last_user_agent = left(coalesce(current_setting('request.headers', true), '{}')::json ->> 'user-agent', 200)
      where id = d.id;
  end if;

  select * into c from private.kiosk_codes
    where device_id = d.id and used_at is null and expires_at > now() + interval '3 seconds'
    order by expires_at desc limit 1;
  if not found then
    insert into private.kiosk_codes (code, device_id, expires_at)
      values (encode(extensions.gen_random_bytes(16), 'hex'), d.id, now() + interval '30 seconds')
      returning * into c;
    delete from private.kiosk_codes where device_id = d.id and expires_at < now() - interval '10 minutes';
    delete from private.kiosk_events where device_id = d.id and created_at < now() - interval '1 day';
  end if;

  select coalesce(max(id), 0) into last_id from private.kiosk_events where device_id = d.id;
  -- solo nome e iniziale del cognome: lo schermo è visibile a tutti all'ingresso
  select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) into ev from (
    select e.id, e.outcome, e.created_at,
      p.first_name || coalesce(' ' || nullif(left(p.last_name, 1), '') || '.', '') as name,
      p.avatar_url
    from private.kiosk_events e join public.profiles p on p.id = e.user_id
    where e.device_id = d.id and e.id > coalesce(p_after, 0) and e.created_at > now() - interval '20 seconds'
    order by e.id limit 5
  ) x;

  return jsonb_build_object('device', d.name, 'code', c.code, 'expires_at', c.expires_at,
    'server_time', now(), 'last_event_id', last_id, 'events', ev);
end $$;

-- ===== Cliente: inquadra il QR del tablet =====
create or replace function public.kiosk_checkin(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  c private.kiosk_codes;
  failed int;
  res jsonb;
  outcome text;
begin
  if uid is null then raise exception 'Devi effettuare l''accesso'; end if;

  -- limite: max 10 tentativi falliti in 10 minuti
  select count(*) into failed from private.checkin_attempts
    where user_id = uid and not ok and created_at > now() - interval '10 minutes';
  if failed >= 10 then
    return jsonb_build_object('status', 'rate_limited', 'allowed', false,
      'reason', 'Troppi tentativi: riprova tra qualche minuto o chiedi in reception');
  end if;

  if p_code is null or p_code !~ '^[0-9a-f]{32}$' then
    insert into private.checkin_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('status', 'invalid', 'allowed', false, 'reason', 'QR non valido');
  end if;

  select k.* into c from private.kiosk_codes k
    join private.kiosk_devices d on d.id = k.device_id and d.revoked_at is null
    where k.code = p_code for update of k;
  if not found then
    insert into private.checkin_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('status', 'invalid', 'allowed', false, 'reason', 'QR non valido');
  end if;
  if c.expires_at + interval '10 seconds' < now() then
    insert into private.checkin_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('status', 'expired', 'allowed', false, 'reason', 'QR scaduto: inquadra quello nuovo sul tablet');
  end if;
  -- monouso: già usato da un'altra persona (la stessa persona può ripetere, vale come "già entrato")
  if c.used_at is not null and c.used_by is distinct from uid then
    return jsonb_build_object('status', 'used', 'allowed', false, 'reason', 'QR appena usato da un altro cliente: inquadra quello nuovo');
  end if;

  res := private.do_checkin(uid, null, c.device_id);

  if (res ->> 'allowed')::boolean then
    update private.kiosk_codes set used_at = coalesce(used_at, now()), used_by = uid where code = c.code;
    outcome := case when (res ->> 'duplicate')::boolean then 'duplicate' else 'ok' end;
  else
    outcome := 'denied';
  end if;
  insert into private.kiosk_events (device_id, user_id, outcome) values (c.device_id, uid, outcome);
  insert into private.checkin_attempts (user_id, ok) values (uid, (res ->> 'allowed')::boolean);
  delete from private.checkin_attempts where user_id = uid and created_at < now() - interval '1 day';

  return res || jsonb_build_object('status', outcome);
end $$;

-- ===== Admin: gestione tablet =====
create or replace function public.admin_kiosk_create(p_name text)
returns text language plpgsql security definer set search_path = '' as $$
declare s text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not private.is_admin() then raise exception 'Non autorizzato'; end if;
  insert into private.kiosk_devices (name, secret_hash, created_by)
    values (left(coalesce(nullif(trim(p_name), ''), 'Tablet ingresso'), 60), extensions.digest(s, 'sha256'), (select auth.uid()));
  return s;  -- mostrato una sola volta per collegare il tablet
end $$;

create or replace function public.admin_kiosk_list()
returns table (id uuid, name text, created_at timestamptz, last_seen_at timestamptz, last_user_agent text, revoked_at timestamptz, checkins_today int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Non autorizzato'; end if;
  return query
    select d.id, d.name, d.created_at, d.last_seen_at, d.last_user_agent, d.revoked_at,
      (select count(*)::int from public.checkins c where c.kiosk_id = d.id and c.allowed
         and c.checked_at >= date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome')
    from private.kiosk_devices d
    order by d.revoked_at nulls first, d.created_at desc;
end $$;

create or replace function public.admin_kiosk_revoke(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Non autorizzato'; end if;
  update private.kiosk_devices set revoked_at = now() where id = p_id and revoked_at is null;
  delete from private.kiosk_codes where device_id = p_id;
end $$;

-- ===== Permessi =====
revoke execute on function private.do_checkin(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.kiosk_device(text) from public, anon, authenticated;
revoke execute on function public.checkin(uuid) from public, anon;
revoke execute on function public.kiosk_poll(text, bigint) from public;
revoke execute on function public.kiosk_checkin(text) from public, anon;
revoke execute on function public.admin_kiosk_create(text) from public, anon;
revoke execute on function public.admin_kiosk_list() from public, anon;
revoke execute on function public.admin_kiosk_revoke(uuid) from public, anon;
grant execute on function public.checkin(uuid) to authenticated;
grant execute on function public.kiosk_poll(text, bigint) to anon, authenticated;
grant execute on function public.kiosk_checkin(text) to authenticated;
grant execute on function public.admin_kiosk_create(text), public.admin_kiosk_list(), public.admin_kiosk_revoke(uuid) to authenticated;
