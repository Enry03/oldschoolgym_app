-- Iscrizioni approvate dall'amministratore
-- Chi si registra da solo resta "in attesa" e non vede né fa nulla (dati, prenotazioni, messaggi,
-- file, ingresso) finché l'admin non lo approva. Il blocco è nel database (RLS + controlli nelle RPC),
-- non solo nell'interfaccia.

create type public.approval_status as enum ('pending','approved','rejected');

alter table public.profiles
  add column approval_status public.approval_status not null default 'pending',
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null,
  add column rejection_reason text check (length(rejection_reason) <= 300);
create index on public.profiles(approval_status) where approval_status = 'pending';
create index on public.profiles(approved_by);

-- Gli account già esistenti restano attivi
update public.profiles set approval_status = 'approved', approved_at = coalesce(approved_at, now());

-- ===== Helper =====
-- true solo per un account approvato e attivo
create or replace function private.is_approved()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select approval_status = 'approved' and is_active from public.profiles where id = (select auth.uid())), false)
$$;
revoke all on function private.is_approved() from public;
grant execute on function private.is_approved() to authenticated, anon;

-- Stesso controllo per un utente qualsiasi (uso interno, es. check-in): non esposto ai client
create or replace function private.is_approved(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select approval_status = 'approved' and is_active from public.profiles where id = p_user), false)
$$;
revoke all on function private.is_approved(uuid) from public, anon, authenticated;

-- Un admin disattivato non è più admin
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid()) and is_active and approval_status = 'approved'), false)
$$;

-- ===== Nuovo utente → profilo in attesa =====
-- Il ruolo admin per l'email del titolare vale solo finché non esiste nessun admin (primo avvio):
-- così una registrazione con quell'email, se l'account venisse cancellato, non diventa admin.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ref uuid;
  bootstrap boolean;
begin
  if meta ? 'referral_code' and length(meta->>'referral_code') > 0 then
    select id into ref from public.profiles where referral_code = upper(meta->>'referral_code') and approval_status = 'approved';
  end if;
  bootstrap := lower(new.email) = 'enricodelprincipemain@gmail.com'
    and not exists (select 1 from public.profiles where role = 'admin');
  insert into public.profiles (id, email, first_name, last_name, phone, role,
    consent_privacy, consent_marketing, consent_at, referred_by, approval_status, approved_at)
  values (
    new.id, new.email,
    left(coalesce(meta->>'first_name',''), 80),
    left(coalesce(meta->>'last_name',''), 80),
    left(meta->>'phone', 40),
    case when bootstrap then 'admin'::public.user_role else 'client'::public.user_role end,
    coalesce((meta->>'consent_privacy')::boolean, false),
    coalesce((meta->>'consent_marketing')::boolean, false),
    case when coalesce((meta->>'consent_privacy')::boolean, false) then now() end,
    ref,
    case when bootstrap then 'approved'::public.approval_status else 'pending'::public.approval_status end,
    case when bootstrap then now() end
  );
  -- il benvenuto arriva all'approvazione (review_signup)
  return new;
end $$;

-- ===== Campi che solo l'admin può cambiare =====
create or replace function private.guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    return new; -- service role / migrazioni
  end if;
  if not private.is_admin() then
    new.role := old.role;
    new.is_active := old.is_active;
    new.qr_token := old.qr_token;
    new.referral_code := old.referral_code;
    new.referred_by := old.referred_by;
    new.approval_status := old.approval_status;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.rejection_reason := old.rejection_reason;
    new.created_at := old.created_at;
    if not private.is_front() then
      new.trainer_id := old.trainer_id;
      -- l'email del profilo è quella di registrazione: il cliente non può cambiarla per spacciarsi per un altro
      new.email := old.email;
    end if;
  end if;
  if new.consent_privacy and not old.consent_privacy then
    new.consent_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists audit_profiles_role on public.profiles;
create trigger audit_profiles_role after update of role, is_active, trainer_id, approval_status on public.profiles
  for each row execute function private.audit();

-- ===== Approvazione (solo admin) =====
create or replace function public.review_signup(p_user uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  target public.profiles;
begin
  if not private.is_admin() then raise exception 'Non autorizzato'; end if;
  if p_user = me then raise exception 'Non puoi modificare la tua approvazione'; end if;
  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'Utente non trovato'; end if;
  if target.role <> 'client' then raise exception 'Solo le iscrizioni dei clienti si approvano qui'; end if;

  if p_approve then
    if target.approval_status = 'approved' then return; end if;
    update public.profiles set approval_status = 'approved', approved_at = now(), approved_by = me, rejection_reason = null
      where id = p_user;
    perform private.notify(p_user, 'Benvenuto in OldSchool Gym! 🥊',
      'La tua iscrizione è stata approvata. Completa il profilo e prenota la tua prima lezione.', 'welcome', '/app/profilo',
      'approved-' || p_user);
  else
    update public.profiles set approval_status = 'rejected', approved_at = null, approved_by = me,
      rejection_reason = nullif(left(trim(coalesce(p_reason, '')), 300), '')
      where id = p_user;
    -- chi viene rifiutato non riceve più notifiche push
    delete from public.push_subscriptions where user_id = p_user;
  end if;
end $$;
revoke execute on function public.review_signup(uuid, boolean, text) from public, anon;
grant execute on function public.review_signup(uuid, boolean, text) to authenticated;

-- ===== Blocco nel database: policy RESTRICTIVE =====
-- Si sommano (AND) a quelle esistenti: un account non approvato non legge né scrive nulla,
-- qualunque cosa dicano le altre policy.
do $$
declare t text;
begin
  foreach t in array array[
    'client_notes','memberships','discount_codes','payments','medical_certificates','bookings',
    'exercises','workout_plans','workout_plan_items','workout_logs','measurements','goals',
    'progress_photos','checkins','notifications','messages','products','sales','audit_log',
    'push_subscriptions','leads'
  ] loop
    execute format(
      'create policy require_approved on public.%I as restrictive for all to authenticated using ((select private.is_approved())) with check ((select private.is_approved()))', t);
  end loop;
end $$;

-- leads: la richiesta di prova resta aperta a tutti (anche da non loggati); il blocco vale per lettura/modifica
drop policy require_approved on public.leads;
create policy require_approved_read on public.leads as restrictive for select to authenticated using ((select private.is_approved()));
create policy require_approved_update on public.leads as restrictive for update to authenticated using ((select private.is_approved()));
create policy require_approved_delete on public.leads as restrictive for delete to authenticated using ((select private.is_approved()));

-- profili: chi è in attesa vede solo il proprio (per sapere lo stato) e non può modificarlo
create policy require_approved_read on public.profiles as restrictive for select to authenticated
  using (id = (select auth.uid()) or (select private.is_approved()));
create policy require_approved_update on public.profiles as restrictive for update to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));
create policy require_approved_delete on public.profiles as restrictive for delete to authenticated
  using ((select private.is_approved()));

-- annunci: chi è in attesa vede solo quelli pubblici (gli stessi visibili senza login)
create policy require_approved_read on public.announcements as restrictive for select to authenticated
  using (audience = 'all' or (select private.is_approved()));
create policy require_approved_write on public.announcements as restrictive for insert to authenticated
  with check ((select private.is_approved()));

-- file (avatar, certificati, foto progressi, media): niente upload né lettura privata finché in attesa
create policy require_approved on storage.objects as restrictive for all to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));

-- ===== Certificato medico =====
-- Il cliente carica il certificato e indica la scadenza da solo: finché la reception non lo verifica
-- non vale per prenotare né per entrare (prima bastava scrivere una scadenza nel 2099).
-- Il file allegato deve stare nella cartella del cliente, non in quella di un altro.
alter policy certs_insert on public.medical_certificates
  with check ((user_id = (select auth.uid()) and verified = false
      and (file_path is null or file_path like (select auth.uid())::text || '/%'))
    or private.is_front());

-- ===== RPC security definer: stesso controllo esplicito =====
create or replace function public.get_staff()
returns table (id uuid, first_name text, last_name text, role public.user_role, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.first_name, p.last_name, p.role, p.avatar_url
  from public.profiles p
  where p.role in ('admin','trainer') and p.is_active and (select private.is_approved())
  order by p.role desc, p.first_name
$$;

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
  ) where (select private.is_approved())
$$;

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
  if not private.is_approved() then raise exception 'La tua iscrizione deve ancora essere approvata dalla palestra'; end if;
  select * into s from public.sessions where id = p_session for update;
  if not found or s.is_cancelled then raise exception 'Lezione non disponibile'; end if;
  if s.starts_at < now() then raise exception 'La lezione è già iniziata'; end if;
  if exists (select 1 from public.closures where day = (s.starts_at at time zone 'Europe/Rome')::date) then
    raise exception 'La palestra è chiusa quel giorno';
  end if;
  m := private.active_membership(uid, (s.starts_at at time zone 'Europe/Rome')::date);
  if m.id is null then raise exception 'Serve un abbonamento attivo per prenotare'; end if;
  if (select block_without_certificate from public.gym_settings where id = 1)
     and not exists (select 1 from public.medical_certificates c
                     where c.user_id = uid and c.verified and c.expires_on >= (s.starts_at at time zone 'Europe/Rome')::date) then
    raise exception 'Serve un certificato medico valido e verificato dalla reception per prenotare';
  end if;

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

create or replace function public.cancel_booking(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.sessions;
  hrs int;
  prev public.booking_status;
begin
  if not private.is_approved() then raise exception 'Non autorizzato'; end if;
  select * into s from public.sessions where id = p_session for update;
  if not found then raise exception 'Lezione non trovata'; end if;
  select status into prev from public.bookings where session_id = p_session and user_id = uid;
  if prev is null or prev not in ('booked','waitlist') then raise exception 'Nessuna prenotazione da disdire'; end if;
  select cancel_hours into hrs from public.gym_settings where id = 1;
  if prev = 'booked' and s.starts_at - make_interval(hours => hrs) < now() then
    raise exception 'Puoi disdire fino a % ore prima dell''inizio', hrs;
  end if;
  update public.bookings set status = 'cancelled', updated_at = now() where session_id = p_session and user_id = uid;
end $$;

-- Check-in: un QR di un account non approvato non apre l'ingresso
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
  if not private.is_staff() or not private.is_approved() then raise exception 'Non autorizzato'; end if;
  select * into p from public.profiles where qr_token = p_token;
  if not found then
    return jsonb_build_object('found', false, 'allowed', false, 'reason', 'QR non riconosciuto');
  end if;
  m := private.active_membership(p.id);
  select block_without_certificate into need_cert from public.gym_settings where id = 1;
  cert_ok := exists (select 1 from public.medical_certificates c where c.user_id = p.id and c.verified and c.expires_on >= current_date);

  if p.approval_status <> 'approved' then ok := false; why := 'Iscrizione non approvata';
  elsif not p.is_active then ok := false; why := 'Account disattivato';
  elsif m.id is null then ok := false; why := 'Abbonamento scaduto o assente';
  elsif need_cert and not cert_ok then ok := false; why := 'Certificato medico mancante, scaduto o non verificato';
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
    update public.bookings b set status = 'attended', updated_at = now()
      from public.sessions s
      where b.session_id = s.id and b.user_id = p.id and b.status = 'booked'
        and s.starts_at between now() - interval '1 hour' and now() + interval '2 hours';
  end if;
  return jsonb_build_object('found', true, 'allowed', ok, 'reason', why,
    'name', p.first_name || ' ' || p.last_name, 'avatar_url', p.avatar_url,
    'plan', m.plan_name, 'end_date', m.end_date, 'entries_left', m.entries_left, 'certificate_ok', cert_ok);
end $$;

-- Comunicazioni solo agli account approvati
create or replace function public.broadcast(p_title text, p_body text, p_target text default 'all', p_link text default '/app/news')
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_front() or not private.is_approved() then raise exception 'Non autorizzato'; end if;
  if p_link is null or p_link !~ '^/[^/\\]' then p_link := '/app/news'; end if;
  insert into public.notifications (user_id, title, body, kind, link)
  select p.id, left(p_title, 140), left(p_body, 2000), 'broadcast', p_link
  from public.profiles p
  where p.is_active and p.approval_status = 'approved' and case p_target
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

create or replace function private.on_announcement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, title, body, kind, link)
  select p.id, '📣 ' || new.title, left(new.body, 140), 'news', '/app/news'
  from public.profiles p
  where p.is_active and p.approval_status = 'approved'
    and (new.audience = 'all' or (new.audience = 'clients' and p.role = 'client') or (new.audience = 'staff' and p.role <> 'client'));
  return new;
end $$;

-- I ripristini dei permessi delle funzioni (0006) valgono anche per quelle ridefinite qui
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in
           ('get_staff','book_session','cancel_booking','checkin','gym_occupancy','broadcast','review_signup')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
