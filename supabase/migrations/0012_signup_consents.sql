-- Iscrizione completa: regolamento, consenso al trattamento dei dati sanitari, minorenni,
-- foto obbligatoria prima dell'approvazione e limite anti abuso sulle richieste di prova.
--
-- Regole (decise lato database, non solo nell'app):
-- * chi si registra indica la data di nascita, accetta il regolamento (versione corrente) e
--   acconsente al trattamento dei dati sanitari (certificato medico);
-- * sotto l'età minima l'iscrizione non si può approvare; sotto i 18 anni servono i dati del
--   genitore e l'admin deve confermare di avere il modulo firmato;
-- * se previsto dalle impostazioni, senza foto profilo (scattata in reception) non si approva;
-- * se l'admin cambia il regolamento, i clienti lo riaccettano al primo accesso.

-- ===== Impostazioni =====
alter table public.gym_settings
  add column rules_text text not null default '',
  add column rules_version int not null default 1,
  add column min_age int not null default 14 check (min_age between 0 and 99),
  add column adult_age int not null default 18 check (adult_age between 14 and 25),
  add column require_photo_for_approval boolean not null default true;

update public.gym_settings set rules_text = $txt$1. L'accesso alla palestra è riservato agli iscritti con iscrizione approvata, abbonamento valido e certificato medico per attività sportiva non agonistica (o agonistica) in corso di validità, consegnato e verificato dalla reception.
2. L'ingresso si registra ogni volta dall'app (QR sul tablet all'ingresso) o in reception. L'account è personale: è vietato prestarlo o farlo usare ad altri. In caso di uso improprio la palestra può sospendere l'account e l'abbonamento.
3. È obbligatorio l'uso di un asciugamano sugli attrezzi e di scarpe pulite, usate solo all'interno della palestra.
4. Al termine dell'esercizio pesi, manubri e attrezzi vanno rimessi al loro posto e le superfici pulite con i prodotti messi a disposizione.
5. Prima di usare macchine o attrezzi che non conosci chiedi istruzioni allo staff. Segui le indicazioni dei trainer e allenati in base alle tue condizioni fisiche.
6. Le lezioni si prenotano dall'app. Se non puoi partecipare disdici entro il termine indicato nell'app: le assenze senza disdetta possono comportare la perdita dell'ingresso.
7. È vietato introdurre o usare sostanze dopanti, alcol o sostanze stupefacenti. È vietato fumare in tutti i locali.
8. Rispetta gli altri iscritti e lo staff: sono vietati comportamenti aggressivi, offensivi o pericolosi.
9. La palestra non risponde di oggetti lasciati incustoditi. Gli armadietti vanno liberati a fine allenamento.
10. Gli abbonamenti sono personali e non rimborsabili, salvo i casi previsti dalla legge o concordati con la palestra. La sospensione per motivi di salute va richiesta in reception con certificato.
11. I minorenni possono iscriversi solo con il consenso firmato di un genitore o di chi esercita la responsabilità genitoriale.
12. Per motivi di sicurezza la palestra può modificare orari e regole: le modifiche vengono comunicate nell'app e vanno accettate per continuare a usarla.$txt$
where id = 1;

-- Il testo cambia → nuova versione da riaccettare
create or replace function private.bump_rules_version()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.rules_text is distinct from old.rules_text then
    new.rules_version := old.rules_version + 1;
  else
    new.rules_version := old.rules_version;
  end if;
  return new;
end $$;
create trigger bump_rules_version before update on public.gym_settings
  for each row execute function private.bump_rules_version();

-- ===== Profili =====
alter table public.profiles
  add column rules_version int,
  add column rules_accepted_at timestamptz,
  add column consent_health boolean not null default false,
  add column consent_health_at timestamptz,
  add column guardian_name text check (length(guardian_name) <= 120),
  add column guardian_phone text check (length(guardian_phone) <= 40),
  add column guardian_email text check (length(guardian_email) <= 200),
  add column guardian_verified_at timestamptz,
  add column guardian_verified_by uuid references public.profiles(id) on delete set null;
create index on public.profiles(guardian_verified_by);

-- Età in anni compiuti (null se manca la data di nascita)
create or replace function private.age_years(p_birth date)
returns int language sql stable set search_path = '' as $$
  select case when p_birth is null then null else extract(year from age(current_date, p_birth))::int end
$$;

-- Data da testo senza far fallire la registrazione se è scritta male
create or replace function private.safe_date(p text)
returns date language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return p::date;
exception when others then
  return null;
end $$;

-- ===== Nuovo utente: salva consensi, nascita e genitore =====
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ref uuid;
  bootstrap boolean;
  cur_rules int;
  birth date := private.safe_date(meta->>'birth_date');
  health boolean := coalesce((meta->>'consent_health') = 'true', false);
  rules_ok boolean;
begin
  if meta ? 'referral_code' and length(meta->>'referral_code') > 0 then
    select id into ref from public.profiles where referral_code = upper(meta->>'referral_code') and approval_status = 'approved';
  end if;
  bootstrap := lower(new.email) = 'enricodelprincipemain@gmail.com'
    and not exists (select 1 from public.profiles where role = 'admin');
  select rules_version into cur_rules from public.gym_settings where id = 1;
  -- vale solo l'accettazione della versione in vigore al momento della registrazione
  rules_ok := (meta->>'rules_version') ~ '^\d{1,6}$' and (meta->>'rules_version')::int = cur_rules;
  if birth is not null and (birth > current_date or birth < date '1900-01-01') then birth := null; end if;

  insert into public.profiles (id, email, first_name, last_name, phone, role,
    consent_privacy, consent_marketing, consent_at, referred_by, approval_status, approved_at,
    birth_date, consent_health, consent_health_at, rules_version, rules_accepted_at,
    guardian_name, guardian_phone, guardian_email)
  values (
    new.id, new.email,
    left(coalesce(meta->>'first_name',''), 80),
    left(coalesce(meta->>'last_name',''), 80),
    left(meta->>'phone', 40),
    case when bootstrap then 'admin'::public.user_role else 'client'::public.user_role end,
    coalesce((meta->>'consent_privacy') = 'true', false),
    coalesce((meta->>'consent_marketing') = 'true', false),
    case when coalesce((meta->>'consent_privacy') = 'true', false) then now() end,
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
    nullif(left(trim(meta->>'guardian_email'), 200), '')
  );
  return new;
end $$;

-- ===== Campi protetti =====
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
    -- accettazione del regolamento e verifica del genitore: solo tramite accept_rules / review_signup
    -- (accept_rules alza un flag locale alla transazione, non impostabile dai client via API)
    if coalesce(current_setting('osg.accepting_rules', true), '') <> '1' then
      new.rules_version := old.rules_version;
      new.rules_accepted_at := old.rules_accepted_at;
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
  if new.consent_privacy and not old.consent_privacy then
    new.consent_at := now();
  end if;
  if new.consent_health is distinct from old.consent_health then
    new.consent_health_at := case when new.consent_health then now() end;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- ===== Accettazione regolamento (anche per chi è stato iscritto dalla reception) =====
create or replace function public.accept_rules(p_version int, p_health boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  cur int;
begin
  if uid is null then raise exception 'Devi effettuare l''accesso'; end if;
  select rules_version into cur from public.gym_settings where id = 1;
  if p_version is distinct from cur then raise exception 'Il regolamento è stato aggiornato: ricarica la pagina'; end if;
  if not coalesce(p_health, false) then raise exception 'Serve il consenso al trattamento dei dati sanitari (certificato medico)'; end if;
  perform set_config('osg.accepting_rules', '1', true);
  update public.profiles
    set rules_version = cur, rules_accepted_at = now(),
        consent_health = true, consent_health_at = coalesce(case when consent_health then consent_health_at end, now()),
        updated_at = now()
    where id = uid;
  perform set_config('osg.accepting_rules', '', true);
end $$;
revoke execute on function public.accept_rules(int, boolean) from public, anon;
grant execute on function public.accept_rules(int, boolean) to authenticated;

-- ===== Approvazione con i nuovi controlli =====
drop function if exists public.review_signup(uuid, boolean, text);
create or replace function public.review_signup(p_user uuid, p_approve boolean, p_reason text default null, p_guardian_ok boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  target public.profiles;
  s public.gym_settings;
  yrs int;
begin
  if not private.is_admin() then raise exception 'Non autorizzato'; end if;
  if p_user = me then raise exception 'Non puoi modificare la tua approvazione'; end if;
  select * into target from public.profiles where id = p_user for update;
  if not found then raise exception 'Utente non trovato'; end if;
  if target.role <> 'client' then raise exception 'Solo le iscrizioni dei clienti si approvano qui'; end if;
  select * into s from public.gym_settings where id = 1;

  if p_approve then
    if target.approval_status = 'approved' then return; end if;
    yrs := private.age_years(target.birth_date);
    if yrs is null then raise exception 'Manca la data di nascita: inseriscila nella scheda del cliente'; end if;
    if yrs < s.min_age then raise exception 'Età minima per iscriversi: % anni', s.min_age; end if;
    if target.rules_version is null then raise exception 'Il cliente non ha accettato il regolamento'; end if;
    if not target.consent_health then raise exception 'Manca il consenso al trattamento dei dati sanitari'; end if;
    if s.require_photo_for_approval and target.avatar_url is null then
      raise exception 'Scatta prima la foto del cliente: serve allo staff per riconoscerlo all''ingresso';
    end if;
    if yrs < s.adult_age then
      if target.guardian_name is null then raise exception 'Minorenne: mancano i dati del genitore'; end if;
      if not coalesce(p_guardian_ok, false) then
        raise exception 'Minorenne: conferma di avere il modulo di consenso firmato dal genitore';
      end if;
    end if;
    update public.profiles set approval_status = 'approved', approved_at = now(), approved_by = me, rejection_reason = null,
        guardian_verified_at = case when yrs < s.adult_age then now() else guardian_verified_at end,
        guardian_verified_by = case when yrs < s.adult_age then me else guardian_verified_by end
      where id = p_user;
    perform private.notify(p_user, 'Benvenuto in OldSchool Gym! 🥊',
      'La tua iscrizione è stata approvata. Completa il profilo e prenota la tua prima lezione.', 'welcome', '/app/profilo',
      'approved-' || p_user);
  else
    update public.profiles set approval_status = 'rejected', approved_at = null, approved_by = me,
      rejection_reason = nullif(left(trim(coalesce(p_reason, '')), 300), '')
      where id = p_user;
    delete from public.push_subscriptions where user_id = p_user;
  end if;
end $$;
revoke execute on function public.review_signup(uuid, boolean, text, boolean) from public, anon;
grant execute on function public.review_signup(uuid, boolean, text, boolean) to authenticated;

-- ===== Foto scattata in reception =====
-- La reception carica la foto nella cartella del cliente (chi è in attesa non può caricare file).
create policy avatars_front_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and private.is_front());
create policy avatars_front_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and private.is_front());
create policy avatars_front_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and private.is_front());

-- ===== Richieste di prova: limite anti abuso =====
-- Il modulo è pubblico: senza limite un bot potrebbe riempire la lista lead.
-- Max 3 richieste per IP all'ora e 30 in totale ogni 10 minuti (l'IP si salva solo come impronta).
alter table public.leads add column ip_hash text;
create index on public.leads(ip_hash, created_at);
create index on public.leads(created_at);

create or replace function private.limit_leads()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  hdr json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  ip text := split_part(coalesce(hdr ->> 'cf-connecting-ip', hdr ->> 'x-forwarded-for', hdr ->> 'x-real-ip', ''), ',', 1);
begin
  if private.is_front() then return new; end if; -- inserimento dallo staff
  new.ip_hash := case when ip <> '' then encode(extensions.digest(trim(ip), 'sha256'), 'hex') end;
  if new.ip_hash is not null and (select count(*) from public.leads
       where ip_hash = new.ip_hash and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'Hai già inviato una richiesta: ti ricontatteremo presto' using errcode = 'P0001';
  end if;
  if (select count(*) from public.leads where created_at > now() - interval '10 minutes' and referred_by is null) >= 30 then
    raise exception 'Troppe richieste in questo momento: riprova tra qualche minuto' using errcode = 'P0001';
  end if;
  new.phone := left(new.phone, 40);
  new.email := left(new.email, 200);
  new.source := left(new.source, 60);
  return new;
end $$;
create trigger limit_leads before insert on public.leads for each row execute function private.limit_leads();

-- ===== Permessi delle funzioni interne =====
revoke all on function private.bump_rules_version(), private.limit_leads(), private.safe_date(text) from public, anon, authenticated;
revoke all on function private.age_years(date) from public, anon;
grant execute on function private.age_years(date) to authenticated;
