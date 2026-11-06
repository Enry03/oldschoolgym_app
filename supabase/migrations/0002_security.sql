-- OldSchool Gym: funzioni di supporto, RLS, trigger

create schema if not exists private;
grant usage on schema private to authenticated, anon;

alter table public.notifications add column dedupe_key text unique;

-- ===== Helper ruoli (security definer, evitano ricorsione RLS) =====
create or replace function private.my_role()
returns public.user_role language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'admin' from public.profiles where id = (select auth.uid())), false)
$$;

-- admin o reception: gestione amministrativa
create or replace function private.is_front()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin','reception') from public.profiles where id = (select auth.uid()) and is_active), false)
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('admin','reception','trainer') from public.profiles where id = (select auth.uid()) and is_active), false)
$$;

-- può vedere i dati di un cliente: se stesso, front desk, oppure il suo trainer
create or replace function private.can_view_client(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = (select auth.uid())
      or private.is_front()
      or exists (
        select 1 from public.profiles c
        join public.profiles me on me.id = (select auth.uid())
        where c.id = target and me.role = 'trainer' and me.is_active and c.trainer_id = me.id
      )
$$;

-- può gestire (scrivere schede/misure) per un cliente: admin o il suo trainer
create or replace function private.can_coach(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or exists (
        select 1 from public.profiles c
        join public.profiles me on me.id = (select auth.uid())
        where c.id = target and me.role = 'trainer' and me.is_active and c.trainer_id = me.id
      )
$$;

revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated, anon;

-- ===== Nuovo utente → profilo =====
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  ref uuid;
begin
  if meta ? 'referral_code' and length(meta->>'referral_code') > 0 then
    select id into ref from public.profiles where referral_code = upper(meta->>'referral_code');
  end if;
  insert into public.profiles (id, email, first_name, last_name, phone, role,
    consent_privacy, consent_marketing, consent_at, referred_by)
  values (
    new.id, new.email,
    left(coalesce(meta->>'first_name',''), 80),
    left(coalesce(meta->>'last_name',''), 80),
    left(meta->>'phone', 40),
    case when lower(new.email) = 'enricodelprincipemain@gmail.com' then 'admin'::public.user_role else 'client'::public.user_role end,
    coalesce((meta->>'consent_privacy')::boolean, false),
    coalesce((meta->>'consent_marketing')::boolean, false),
    case when coalesce((meta->>'consent_privacy')::boolean, false) then now() end,
    ref
  );
  insert into public.notifications (user_id, title, body, kind, link)
  values (new.id, 'Benvenuto in OldSchool Gym! 🥊', 'Completa il profilo e prenota la tua prima lezione.', 'welcome', '/app/profilo');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ===== Protezione campi sensibili del profilo =====
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
    if not private.is_front() then
      new.trainer_id := old.trainer_id;
    end if;
  end if;
  if new.consent_privacy and not old.consent_privacy then
    new.consent_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger guard_profile before update on public.profiles
  for each row execute function private.guard_profile();

-- ===== Registro attività =====
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce((case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id', ''),
    case
      when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new))
      when tg_op = 'DELETE' then to_jsonb(old)
      else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger audit_memberships after insert or update or delete on public.memberships for each row execute function private.audit();
create trigger audit_payments after insert or update or delete on public.payments for each row execute function private.audit();
create trigger audit_plans after insert or update or delete on public.plans for each row execute function private.audit();
create trigger audit_certs after insert or update or delete on public.medical_certificates for each row execute function private.audit();
create trigger audit_sales after insert or update or delete on public.sales for each row execute function private.audit();
create trigger audit_settings after update on public.gym_settings for each row execute function private.audit();
create trigger audit_profiles_role after update of role, is_active, trainer_id on public.profiles for each row execute function private.audit();

-- ===== RLS =====
alter table public.profiles enable row level security;
alter table public.client_notes enable row level security;
alter table public.gym_settings enable row level security;
alter table public.closures enable row level security;
alter table public.plans enable row level security;
alter table public.memberships enable row level security;
alter table public.discount_codes enable row level security;
alter table public.payments enable row level security;
alter table public.medical_certificates enable row level security;
alter table public.courses enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_plan_items enable row level security;
alter table public.workout_logs enable row level security;
alter table public.measurements enable row level security;
alter table public.goals enable row level security;
alter table public.progress_photos enable row level security;
alter table public.checkins enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.leads enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.audit_log enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_staff() and (role <> 'client' or private.can_view_client(id)));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_front())
  with check (id = (select auth.uid()) or private.is_front());
create policy profiles_delete on public.profiles for delete to authenticated
  using (private.is_admin());

-- client_notes
create policy notes_select on public.client_notes for select to authenticated
  using (private.is_staff() and private.can_view_client(client_id));
create policy notes_insert on public.client_notes for insert to authenticated
  with check (private.is_staff() and private.can_view_client(client_id) and author_id = (select auth.uid()));
create policy notes_delete on public.client_notes for delete to authenticated
  using (author_id = (select auth.uid()) or private.is_admin());

-- gym_settings / closures (pubblici in lettura)
create policy settings_select on public.gym_settings for select to anon, authenticated using (true);
create policy settings_update on public.gym_settings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy closures_select on public.closures for select to anon, authenticated using (true);
create policy closures_write on public.closures for all to authenticated using (private.is_front()) with check (private.is_front());

-- plans
create policy plans_select on public.plans for select to anon, authenticated using (is_active or private.is_front());
create policy plans_write on public.plans for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- memberships
create policy memberships_select on public.memberships for select to authenticated using (private.can_view_client(user_id));
create policy memberships_write on public.memberships for all to authenticated using (private.is_front()) with check (private.is_front());

-- discount codes
create policy discounts_all on public.discount_codes for all to authenticated using (private.is_front()) with check (private.is_front());

-- payments (non visibili ai trainer)
create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or private.is_front());
create policy payments_write on public.payments for all to authenticated using (private.is_front()) with check (private.is_front());

-- medical certificates
create policy certs_select on public.medical_certificates for select to authenticated using (private.can_view_client(user_id));
create policy certs_insert on public.medical_certificates for insert to authenticated
  with check ((user_id = (select auth.uid()) and verified = false) or private.is_front());
create policy certs_update on public.medical_certificates for update to authenticated using (private.is_front()) with check (private.is_front());
create policy certs_delete on public.medical_certificates for delete to authenticated
  using (private.is_front() or (user_id = (select auth.uid()) and verified = false));

-- courses & sessions (pubblici in lettura)
create policy courses_select on public.courses for select to anon, authenticated using (is_active or private.is_staff());
create policy courses_write on public.courses for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy sessions_select on public.sessions for select to anon, authenticated using (true);
create policy sessions_insert on public.sessions for insert to authenticated
  with check (private.is_front() or (private.my_role() = 'trainer' and trainer_id = (select auth.uid())));
create policy sessions_update on public.sessions for update to authenticated
  using (private.is_front() or (private.my_role() = 'trainer' and trainer_id = (select auth.uid())))
  with check (private.is_front() or (private.my_role() = 'trainer' and trainer_id = (select auth.uid())));
create policy sessions_delete on public.sessions for delete to authenticated using (private.is_front());

-- bookings: i clienti passano dalle funzioni book_session / cancel_booking
create policy bookings_select on public.bookings for select to authenticated
  using (user_id = (select auth.uid()) or private.is_front()
    or exists (select 1 from public.sessions s where s.id = session_id and s.trainer_id = (select auth.uid())));
create policy bookings_staff_update on public.bookings for update to authenticated
  using (private.is_front() or exists (select 1 from public.sessions s where s.id = session_id and s.trainer_id = (select auth.uid())))
  with check (private.is_front() or exists (select 1 from public.sessions s where s.id = session_id and s.trainer_id = (select auth.uid())));
create policy bookings_staff_insert on public.bookings for insert to authenticated with check (private.is_front());
create policy bookings_staff_delete on public.bookings for delete to authenticated using (private.is_front());

-- exercises
create policy exercises_select on public.exercises for select to authenticated using (true);
create policy exercises_write on public.exercises for all to authenticated
  using (private.is_admin() or private.my_role() = 'trainer') with check (private.is_admin() or private.my_role() = 'trainer');

-- workout plans
create policy wp_select on public.workout_plans for select to authenticated
  using ((user_id is not null and private.can_view_client(user_id)) or (is_template and private.is_staff()) or created_by = (select auth.uid()));
create policy wp_insert on public.workout_plans for insert to authenticated
  with check (private.is_staff() and private.my_role() <> 'reception' and created_by = (select auth.uid())
    and (user_id is null or private.can_coach(user_id)));
create policy wp_update on public.workout_plans for update to authenticated
  using (private.is_admin() or created_by = (select auth.uid()) or (user_id is not null and private.can_coach(user_id)))
  with check (private.is_admin() or created_by = (select auth.uid()) or (user_id is not null and private.can_coach(user_id)));
create policy wp_delete on public.workout_plans for delete to authenticated
  using (private.is_admin() or created_by = (select auth.uid()));

create policy wpi_select on public.workout_plan_items for select to authenticated
  using (exists (select 1 from public.workout_plans p where p.id = plan_id));
create policy wpi_write on public.workout_plan_items for all to authenticated
  using (exists (select 1 from public.workout_plans p where p.id = plan_id
    and (private.is_admin() or p.created_by = (select auth.uid()) or (p.user_id is not null and private.can_coach(p.user_id)))))
  with check (exists (select 1 from public.workout_plans p where p.id = plan_id
    and (private.is_admin() or p.created_by = (select auth.uid()) or (p.user_id is not null and private.can_coach(p.user_id)))));

-- workout logs (diario del cliente)
create policy wl_select on public.workout_logs for select to authenticated using (private.can_view_client(user_id));
create policy wl_write on public.workout_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- measurements
create policy meas_select on public.measurements for select to authenticated using (private.can_view_client(user_id));
create policy meas_insert on public.measurements for insert to authenticated
  with check ((user_id = (select auth.uid()) or private.can_coach(user_id) or private.is_front()) and created_by = (select auth.uid()));
create policy meas_update on public.measurements for update to authenticated
  using (created_by = (select auth.uid()) or private.is_admin()) with check (created_by = (select auth.uid()) or private.is_admin());
create policy meas_delete on public.measurements for delete to authenticated
  using (created_by = (select auth.uid()) or private.is_admin());

-- goals
create policy goals_select on public.goals for select to authenticated using (private.can_view_client(user_id));
create policy goals_write on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- progress photos: solo il proprietario
create policy photos_own on public.progress_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- checkins (scritti da funzione checkin)
create policy checkins_select on public.checkins for select to authenticated using (private.can_view_client(user_id));

-- announcements
create policy ann_select on public.announcements for select to anon, authenticated
  using (published_at <= now() and (audience = 'all'
    or (audience = 'clients' and (select auth.uid()) is not null)
    or (audience = 'staff' and private.is_staff())) or private.is_front());
create policy ann_write on public.announcements for all to authenticated using (private.is_front()) with check (private.is_front());

-- notifications
create policy notif_select on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notif_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.notifications for delete to authenticated using (user_id = (select auth.uid()));
create policy notif_insert on public.notifications for insert to authenticated
  with check (private.is_front() or (private.my_role() = 'trainer' and private.can_coach(user_id)));

-- messages: cliente ↔ staff
create policy msg_select on public.messages for select to authenticated
  using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));
create policy msg_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and (
    private.is_staff() and private.can_view_client(recipient_id)
    or exists (select 1 from public.profiles r where r.id = recipient_id and r.role <> 'client' and r.is_active)
  ));
create policy msg_update on public.messages for update to authenticated
  using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));

-- leads: chiunque può chiedere una prova, solo il front desk li vede
create policy leads_insert on public.leads for insert to anon, authenticated
  with check (status = 'new' and length(full_name) between 2 and 120
    and coalesce(length(notes), 0) <= 1000
    and (referred_by is null or referred_by = (select auth.uid())));
create policy leads_select on public.leads for select to authenticated using (private.is_front());
create policy leads_update on public.leads for update to authenticated using (private.is_front()) with check (private.is_front());
create policy leads_delete on public.leads for delete to authenticated using (private.is_front());

-- products & sales
create policy products_select on public.products for select to authenticated using (is_active or private.is_front());
create policy products_write on public.products for all to authenticated using (private.is_front()) with check (private.is_front());
create policy sales_all on public.sales for all to authenticated using (private.is_front()) with check (private.is_front());

-- audit log
create policy audit_select on public.audit_log for select to authenticated using (private.is_admin());
