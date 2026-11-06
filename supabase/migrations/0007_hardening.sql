-- Il destinatario di un messaggio può solo segnarlo come letto
revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;

-- Le notifiche si possono solo segnare come lette
revoke update on public.notifications from authenticated, anon;
grant update (read_at) on public.notifications to authenticated;

-- La reception modifica solo i profili dei clienti; staff e admin li modifica solo l'admin
alter policy profiles_update on public.profiles
  using ((id = (select auth.uid())) or private.is_admin() or (private.is_front() and role = 'client'))
  with check ((id = (select auth.uid())) or private.is_admin() or (private.is_front() and role = 'client'));
