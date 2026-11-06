create or replace function private.is_active_staff(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles r where r.id = target and r.role <> 'client' and r.is_active)
$$;

-- I clienti possono scrivere allo staff attivo (policy permissiva aggiuntiva)
create policy msg_insert_to_staff on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_active_staff(recipient_id));

-- Permessi funzioni
revoke execute on all functions in schema public from public, anon;
grant execute on function public.get_staff, public.get_sessions, public.book_session, public.cancel_booking,
  public.checkin, public.admin_dashboard, public.admin_stats, public.gym_occupancy, public.broadcast,
  public.export_my_data to authenticated;
grant execute on function public.get_sessions to anon;
revoke all on all functions in schema private from public;
grant execute on function private.my_role, private.is_admin, private.is_front, private.is_staff,
  private.can_view_client, private.can_coach, private.is_active_staff to authenticated, anon;
