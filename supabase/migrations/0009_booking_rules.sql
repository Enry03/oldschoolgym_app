-- Regole prenotazioni: certificato obbligatorio (se richiesto) e lista d'attesa automatica

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
  if (select block_without_certificate from public.gym_settings where id = 1)
     and not exists (select 1 from public.medical_certificates c
                     where c.user_id = uid and c.expires_on >= (s.starts_at at time zone 'Europe/Rome')::date) then
    raise exception 'Serve un certificato medico valido per prenotare: caricalo dal profilo';
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

-- Disdici (rispettando la regola delle ore). La lista d'attesa avanza con il trigger promote_waitlist.
create or replace function public.cancel_booking(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  s public.sessions;
  hrs int;
  prev public.booking_status;
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
end $$;

-- Riempie i posti liberi dalla lista d'attesa (in ordine di arrivo) e avvisa chi entra
create or replace function private.fill_from_waitlist(p_session uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  s public.sessions;
  free int;
  r record;
begin
  select * into s from public.sessions where id = p_session;
  if not found or s.is_cancelled or s.starts_at <= now() then return; end if;
  select s.capacity - count(*) into free from public.bookings b
    where b.session_id = p_session and b.status in ('booked','attended');
  if free <= 0 then return; end if;
  for r in select b.id, b.user_id from public.bookings b
           where b.session_id = p_session and b.status = 'waitlist'
           order by b.created_at limit free for update skip locked loop
    update public.bookings set status = 'booked', updated_at = now() where id = r.id;
    perform private.notify(r.user_id, 'Si è liberato un posto! 🎉',
      'Sei passato dalla lista d''attesa a prenotato: ' || s.title || ' · ' || to_char(s.starts_at at time zone 'Europe/Rome', 'DD/MM HH24:MI'),
      'waitlist', '/app/calendario');
  end loop;
end $$;
revoke execute on function private.fill_from_waitlist(uuid) from public, anon, authenticated;

create or replace function private.promote_waitlist()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'bookings' then
    if old.status in ('booked','attended') and new.status in ('cancelled','waitlist') then
      perform private.fill_from_waitlist(new.session_id);
    end if;
  elsif tg_table_name = 'sessions' then
    if new.capacity > old.capacity then
      perform private.fill_from_waitlist(new.id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.promote_waitlist() from public, anon, authenticated;

create trigger promote_waitlist_on_booking after update of status on public.bookings
  for each row execute function private.promote_waitlist();
create trigger promote_waitlist_on_capacity after update of capacity on public.sessions
  for each row execute function private.promote_waitlist();
