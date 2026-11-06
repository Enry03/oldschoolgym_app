-- OldSchool Gym: storage, realtime, cron

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('media', 'media', true, 10485760, array['image/jpeg','image/png','image/webp']),
  ('certificates', 'certificates', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('progress', 'progress', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- avatars: ognuno scrive nella propria cartella
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- media (news, esercizi): staff
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and private.is_staff());
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and private.is_staff());

-- certificati: proprietario + front desk (+ trainer del cliente in lettura)
create policy certs_read on storage.objects for select to authenticated
  using (bucket_id = 'certificates' and private.can_view_client(((storage.foldername(name))[1])::uuid));
create policy certs_write on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_front()));
create policy certs_remove on storage.objects for delete to authenticated
  using (bucket_id = 'certificates' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_front()));

-- foto progressi: solo il proprietario
create policy progress_own_select on storage.objects for select to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy progress_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- realtime
alter publication supabase_realtime add table public.notifications, public.messages, public.checkins, public.bookings;

-- cron: promemoria ogni ora
create extension if not exists pg_cron;
select cron.schedule('oldschool-reminders', '5 * * * *', $$select private.run_reminders()$$);
