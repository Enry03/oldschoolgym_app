-- Il listino non è pubblico: prezzi e piani li vedono solo gli utenti con l'accesso e già approvati
-- (la policy restrittiva require_approved vale per tutte le tabelle) e lo staff. Prima anche l'accesso
-- anonimo via API poteva leggere la tabella plans.
drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select to authenticated
  using (is_active or private.is_front());
revoke select on public.plans from anon;
