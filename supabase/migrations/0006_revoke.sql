-- Limita l'esecuzione delle funzioni: solo utenti autenticati, helper interni non esposti
revoke execute on function private.notify(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function private.run_reminders() from public, anon, authenticated;
revoke execute on function private.active_membership(uuid, date) from public, anon, authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in
           ('get_staff','get_sessions','book_session','cancel_booking','checkin','admin_dashboard','admin_stats','gym_occupancy','broadcast','export_my_data')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
