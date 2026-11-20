-- Pagamenti conservati quando un account viene eliminato.
--
-- Le ricevute e gli incassi servono alla contabilità della palestra anche dopo che il cliente
-- ha cancellato l'account (obbligo di legge: la conservazione è una base giuridica valida per il GDPR).
-- * payments.user_id ora diventa NULL invece di cancellare la riga; il nome resta in customer_name.
-- * I pagamenti ancora "in sospeso" dell'utente eliminato si cancellano: non c'è più nessuno da sollecitare.
-- * Vincolo: un pagamento senza cliente non può essere "in sospeso" (i solleciti automatici lo richiedono).

alter table public.payments add column if not exists customer_name text;

update public.payments p set customer_name = nullif(trim(coalesce(pr.first_name, '') || ' ' || coalesce(pr.last_name, '')), '')
  from public.profiles pr where pr.id = p.user_id and p.customer_name is null;

create or replace function private.payment_customer_name()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.user_id is not null and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id) then
    new.customer_name := (select nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')
                          from public.profiles where id = new.user_id);
  elsif tg_op = 'UPDATE' and new.user_id is null then
    new.customer_name := old.customer_name; -- dopo l'eliminazione il nome non si modifica
  end if;
  return new;
end $$;
revoke execute on function private.payment_customer_name() from public, anon, authenticated;

drop trigger if exists payment_customer_name on public.payments;
create trigger payment_customer_name before insert or update on public.payments
  for each row execute function private.payment_customer_name();

-- prima che il profilo sparisca: via i pagamenti in sospeso, il resto resta con il nome
create or replace function private.payments_on_profile_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.payments where user_id = old.id and status = 'pending';
  return old;
end $$;
revoke execute on function private.payments_on_profile_delete() from public, anon, authenticated;

drop trigger if exists payments_on_profile_delete on public.profiles;
create trigger payments_on_profile_delete before delete on public.profiles
  for each row execute function private.payments_on_profile_delete();

alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;
alter table public.payments drop constraint if exists payments_pending_needs_user;
alter table public.payments add constraint payments_pending_needs_user
  check (user_id is not null or status = 'paid');

-- Verifica (deve restituire: set null | true)
select (select case confdeltype when 'n' then 'set null' else confdeltype::text end
          from pg_constraint where conname = 'payments_user_id_fkey') as on_delete,
       exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'payments' and column_name = 'customer_name') as customer_name_ok;
