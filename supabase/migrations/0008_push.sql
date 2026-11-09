-- Notifiche push sul telefono (Web Push)
create extension if not exists pg_net with schema extensions;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) < 200),
  auth text not null check (length(auth) < 100),
  user_agent text check (length(user_agent) < 300),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

create policy push_select on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy push_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy push_delete on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Configurazione interna (non esposta dalle API): URL della funzione e segreto condiviso
create table if not exists private.app_config (
  key text primary key,
  value text not null
);
revoke all on private.app_config from public, anon, authenticated;

-- A ogni nuova notifica in app, chiede alla edge function di inviarla anche sul telefono
create or replace function private.push_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  fn_url text;
  secret text;
begin
  select value into fn_url from private.app_config where key = 'push_function_url';
  select value into secret from private.app_config where key = 'push_hook_secret';
  if fn_url is null or secret is null then
    return new; -- push non ancora configurate
  end if;
  if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    return new;
  end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    timeout_milliseconds := 5000
  );
  return new;
end $$;
revoke execute on function private.push_notification() from public, anon, authenticated;

create trigger push_on_notification after insert on public.notifications
  for each row execute function private.push_notification();

-- Configurazione da eseguire una volta (valori fuori dal repository):
-- insert into private.app_config values
--   ('push_function_url', 'https://<ref>.supabase.co/functions/v1/send-push'),
--   ('push_hook_secret', '<segreto casuale, uguale al secret PUSH_HOOK_SECRET della funzione>');
