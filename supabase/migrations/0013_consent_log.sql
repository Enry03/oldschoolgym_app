-- Registro dei consensi e versione dell'informativa privacy.
--
-- * gym_settings.privacy_version: versione dell'informativa privacy (e del consenso ai dati
--   sanitari, che ne fa parte). Quando il testo cambia, l'admin alza il numero e i clienti la
--   riaccettano al primo accesso, come per il regolamento.
-- * profiles.privacy_version: versione accettata da ciascun utente.
-- * consent_log: storico in sola aggiunta di ogni consenso dato o revocato (privacy, regolamento,
--   dati sanitari, marketing, foto, modulo del genitore), con versione, data e chi l'ha registrato.
--   Lo scrive solo il database: i client possono solo leggere il proprio, lo staff di reception tutti.

-- ===== Versione informativa =====
alter table public.gym_settings
  add column privacy_version int not null default 1 check (privacy_version between 1 and 999999);
alter table public.profiles add column privacy_version int;
-- chi ha già accettato l'informativa l'ha fatto sulla versione 1
update public.profiles set privacy_version = 1 where consent_privacy;

-- ===== Registro consensi =====
create table public.consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('privacy', 'rules', 'health', 'marketing', 'photos', 'guardian')),
  granted boolean not null,
  version int,
  actor_id uuid, -- chi l'ha registrato: l'utente stesso, lo staff, o null se dal sistema
  created_at timestamptz not null default now()
);
create index on public.consent_log(user_id, created_at desc);
alter table public.consent_log enable row level security;
create policy consent_log_read on public.consent_log for select to authenticated
  using (user_id = (select auth.uid()) or private.is_front());
revoke all on public.consent_log from anon, authenticated;
grant select on public.consent_log to authenticated;

create or replace function private.log_consents()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.consent_log(user_id, kind, granted, version, actor_id)
    select new.id, k, g, v, who from (values
      ('privacy', new.consent_privacy, new.privacy_version),
      ('rules', new.rules_version is not null, new.rules_version),
      ('health', new.consent_health, new.privacy_version),
      ('marketing', new.consent_marketing, null::int),
      ('photos', new.consent_photos, null::int)) x(k, g, v)
    where g; -- alla registrazione si annotano solo i consensi dati
    return new;
  end if;
  if new.consent_privacy is distinct from old.consent_privacy or new.privacy_version is distinct from old.privacy_version then
    insert into public.consent_log(user_id, kind, granted, version, actor_id) values (new.id, 'privacy', new.consent_privacy, new.privacy_version, who);
  end if;
  if new.rules_version is distinct from old.rules_version then
    insert into public.consent_log(user_id, kind, granted, version, actor_id) values (new.id, 'rules', new.rules_version is not null, new.rules_version, who);
  end if;
  if new.consent_health is distinct from old.consent_health then
    insert into public.consent_log(user_id, kind, granted, version, actor_id) values (new.id, 'health', new.consent_health, new.privacy_version, who);
  end if;
  if new.consent_marketing is distinct from old.consent_marketing then
    insert into public.consent_log(user_id, kind, granted, actor_id) values (new.id, 'marketing', new.consent_marketing, who);
  end if;
  if new.consent_photos is distinct from old.consent_photos then
    insert into public.consent_log(user_id, kind, granted, actor_id) values (new.id, 'photos', new.consent_photos, who);
  end if;
  if new.guardian_verified_at is distinct from old.guardian_verified_at and new.guardian_verified_at is not null then
    insert into public.consent_log(user_id, kind, granted, actor_id) values (new.id, 'guardian', true, who);
  end if;
  return new;
end $$;
create trigger log_consents after insert or update on public.profiles
  for each row execute function private.log_consents();
revoke all on function private.log_consents() from public, anon, authenticated;

-- stato attuale di chi c'è già, così lo storico parte completo
insert into public.consent_log(user_id, kind, granted, version, created_at)
select p.id, x.k, true, x.v, coalesce(x.at, p.created_at) from public.profiles p
cross join lateral (values
  ('privacy', p.consent_privacy, p.privacy_version, p.consent_at),
  ('rules', p.rules_version is not null, p.rules_version, p.rules_accepted_at),
  ('health', p.consent_health, p.privacy_version, p.consent_health_at),
  ('marketing', p.consent_marketing, null::int, p.consent_at),
  ('photos', p.consent_photos, null::int, null::timestamptz),
  ('guardian', p.guardian_verified_at is not null, null::int, p.guardian_verified_at)) x(k, g, v, at)
where x.g;

-- ===== Nuovo utente: salva anche la versione dell'informativa =====
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ref uuid;
  bootstrap boolean;
  cur_rules int;
  cur_privacy int;
  birth date := private.safe_date(meta->>'birth_date');
  health boolean := coalesce((meta->>'consent_health') = 'true', false);
  privacy boolean := coalesce((meta->>'consent_privacy') = 'true', false);
  rules_ok boolean;
  privacy_ok boolean;
begin
  if meta ? 'referral_code' and length(meta->>'referral_code') > 0 then
    select id into ref from public.profiles where referral_code = upper(meta->>'referral_code') and approval_status = 'approved';
  end if;
  bootstrap := lower(new.email) = 'enricodelprincipemain@gmail.com'
    and not exists (select 1 from public.profiles where role = 'admin');
  select rules_version, privacy_version into cur_rules, cur_privacy from public.gym_settings where id = 1;
  -- vale solo l'accettazione della versione in vigore al momento della registrazione
  rules_ok := (meta->>'rules_version') ~ '^\d{1,6}$' and (meta->>'rules_version')::int = cur_rules;
  privacy_ok := privacy and (meta->>'privacy_version') ~ '^\d{1,6}$' and (meta->>'privacy_version')::int = cur_privacy;
  if birth is not null and (birth > current_date or birth < date '1900-01-01') then birth := null; end if;

  insert into public.profiles (id, email, first_name, last_name, phone, role,
    consent_privacy, consent_marketing, consent_at, referred_by, approval_status, approved_at,
    birth_date, consent_health, consent_health_at, rules_version, rules_accepted_at,
    guardian_name, guardian_phone, guardian_email, privacy_version)
  values (
    new.id, new.email,
    left(coalesce(meta->>'first_name',''), 80),
    left(coalesce(meta->>'last_name',''), 80),
    left(meta->>'phone', 40),
    case when bootstrap then 'admin'::public.user_role else 'client'::public.user_role end,
    privacy,
    coalesce((meta->>'consent_marketing') = 'true', false),
    case when privacy then now() end,
    ref,
    case when bootstrap then 'approved'::public.approval_status else 'pending'::public.approval_status end,
    case when bootstrap then now() end,
    birth,
    health,
    case when health then now() end,
    case when rules_ok then cur_rules end,
    case when rules_ok then now() end,
    nullif(left(trim(meta->>'guardian_name'), 120), ''),
    nullif(left(trim(meta->>'guardian_phone'), 40), ''),
    nullif(left(trim(meta->>'guardian_email'), 200), ''),
    case when privacy_ok then cur_privacy end
  );
  return new;
end $$;

-- ===== Campi protetti: la versione dell'informativa si registra solo con accept_rules =====
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
    -- accettazione di regolamento e informativa e verifica del genitore: solo tramite accept_rules / review_signup
    -- (accept_rules alza un flag locale alla transazione, non impostabile dai client via API)
    if coalesce(current_setting('osg.accepting_rules', true), '') <> '1' then
      new.rules_version := old.rules_version;
      new.rules_accepted_at := old.rules_accepted_at;
      new.privacy_version := old.privacy_version;
    end if;
    new.guardian_verified_at := old.guardian_verified_at;
    new.guardian_verified_by := old.guardian_verified_by;
    if not private.is_front() then
      new.trainer_id := old.trainer_id;
      new.email := old.email;
      -- data di nascita e genitore li corregge solo la reception (servono a decidere sui minorenni)
      new.birth_date := old.birth_date;
      new.guardian_name := old.guardian_name;
      new.guardian_phone := old.guardian_phone;
      new.guardian_email := old.guardian_email;
      -- il consenso sanitario si può revocare, ma si dà solo con accept_rules
      if new.consent_health and not old.consent_health and coalesce(current_setting('osg.accepting_rules', true), '') <> '1' then
        new.consent_health := false;
      end if;
    end if;
  end if;
  -- senza consenso privacy non resta una versione accettata
  if not new.consent_privacy then
    new.privacy_version := null;
  end if;
  if new.consent_privacy and not old.consent_privacy then
    new.consent_at := now();
  end if;
  if new.consent_health is distinct from old.consent_health then
    new.consent_health_at := case when new.consent_health then now() end;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ===== Accettazione di regolamento e informativa =====
-- p_privacy facoltativo: l'app vecchia lo omette e continua a funzionare finché non si aggiorna.
drop function if exists public.accept_rules(int, boolean);
create or replace function public.accept_rules(p_version int, p_health boolean, p_privacy int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  cur int;
  curp int;
begin
  if uid is null then raise exception 'Devi effettuare l''accesso'; end if;
  select rules_version, privacy_version into cur, curp from public.gym_settings where id = 1;
  if p_version is distinct from cur then raise exception 'Il regolamento è stato aggiornato: ricarica la pagina'; end if;
  if p_privacy is not null and p_privacy <> curp then raise exception 'L''informativa privacy è stata aggiornata: ricarica la pagina'; end if;
  if not coalesce(p_health, false) then raise exception 'Serve il consenso al trattamento dei dati sanitari (certificato medico)'; end if;
  perform set_config('osg.accepting_rules', '1', true);
  update public.profiles
    set rules_version = cur,
        rules_accepted_at = case when rules_version is distinct from cur then now() else rules_accepted_at end,
        consent_health = true, consent_health_at = coalesce(case when consent_health then consent_health_at end, now()),
        consent_privacy = consent_privacy or p_privacy is not null,
        privacy_version = coalesce(p_privacy, privacy_version),
        updated_at = now()
    where id = uid;
  perform set_config('osg.accepting_rules', '', true);
end $$;
revoke execute on function public.accept_rules(int, boolean, int) from public, anon;
grant execute on function public.accept_rules(int, boolean, int) to authenticated;
