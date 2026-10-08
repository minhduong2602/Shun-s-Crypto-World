-- Serialize each owner's transaction writes. Validate the complete statement
-- afterward so multi-row CSV imports are not dependent on row trigger order.
create or replace function public.lock_portfolio_transaction_owner()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_owner_id uuid;
begin
  if tg_op = 'DELETE' then
    v_owner_id := old.owner_id;
  else
    new.symbol := upper(trim(new.symbol));
    v_owner_id := new.owner_id;
    if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
      raise exception using errcode = '42501', message = 'Transaction ownership cannot be changed.';
    end if;
    if new.symbol !~ '^[A-Z0-9]{2,20}$' then
      raise exception using errcode = '23514', message = 'Transaction symbol is invalid.';
    end if;
  end if;

  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Authentication is required to validate transaction balances.';
  end if;
  if auth.uid() is not null and auth.uid() is distinct from v_owner_id then
    raise exception using errcode = '42501', message = 'Cannot change another user transaction.';
  end if;

  -- All transaction mutations for one owner are serialized, including edits
  -- that move a transaction between symbols and bulk imports with many assets.
  -- Service-role batch writes may touch multiple owners in arbitrary row order;
  -- serialize those rare administrative statements to prevent cross-owner deadlocks.
  if coalesce(auth.role(), '') = 'service_role' then
    perform pg_catalog.pg_advisory_xact_lock(786438204958177);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_owner_id::text, 0));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.assert_portfolio_transaction_balances(p_owner_id uuid, p_symbols text[])
returns void
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_symbol text;
  v_min_balance numeric;
begin
  foreach v_symbol in array p_symbols loop
    select min(running_balance) into v_min_balance
    from (
      select sum(case when tx.type in ('BUY', 'TRANSFER_IN') then tx.amount else -tx.amount end)
        over (order by tx.executed_at, tx.created_at, tx.id rows between unbounded preceding and current row) as running_balance
      from public.portfolio_transactions as tx
      where tx.owner_id = p_owner_id and upper(tx.symbol) = upper(v_symbol)
    ) as balances;

    if v_min_balance < 0 then
      raise exception using
        errcode = '23514',
        constraint = 'portfolio_transactions_nonnegative_balance',
        message = 'Transaction would make chronological asset balance negative.';
    end if;
  end loop;
end;
$function$;

create or replace function public.validate_inserted_portfolio_transaction_balances()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row record;
begin
  for v_row in
    select distinct inserted.owner_id, upper(inserted.symbol) as symbol
    from inserted_portfolio_transactions as inserted
    order by 1, 2
  loop
    perform public.assert_portfolio_transaction_balances(v_row.owner_id, array[v_row.symbol]);
  end loop;
  return null;
end;
$function$;

create or replace function public.validate_updated_portfolio_transaction_balances()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row record;
begin
  for v_row in
    select affected.owner_id, affected.symbol
    from (
      select old_rows.owner_id, upper(old_rows.symbol) as symbol from old_portfolio_transactions as old_rows
      union
      select new_rows.owner_id, upper(new_rows.symbol) as symbol from new_portfolio_transactions as new_rows
    ) as affected
    order by affected.owner_id, affected.symbol
  loop
    perform public.assert_portfolio_transaction_balances(v_row.owner_id, array[v_row.symbol]);
  end loop;
  return null;
end;
$function$;

create or replace function public.validate_deleted_portfolio_transaction_balances()
returns trigger
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row record;
begin
  for v_row in
    select distinct deleted.owner_id, upper(deleted.symbol) as symbol
    from deleted_portfolio_transactions as deleted
    order by 1, 2
  loop
    perform public.assert_portfolio_transaction_balances(v_row.owner_id, array[v_row.symbol]);
  end loop;
  return null;
end;
$function$;

create index if not exists portfolio_transactions_owner_symbol_order_idx
  on public.portfolio_transactions (owner_id, upper(symbol), executed_at, created_at, id);

revoke all on function public.lock_portfolio_transaction_owner() from public, anon, authenticated;
revoke all on function public.assert_portfolio_transaction_balances(uuid, text[]) from public, anon, authenticated;
revoke all on function public.validate_inserted_portfolio_transaction_balances() from public, anon, authenticated;
revoke all on function public.validate_updated_portfolio_transaction_balances() from public, anon, authenticated;
revoke all on function public.validate_deleted_portfolio_transaction_balances() from public, anon, authenticated;

drop trigger if exists portfolio_transactions_lock_owner on public.portfolio_transactions;
create trigger portfolio_transactions_lock_owner
before insert or update or delete on public.portfolio_transactions
for each row execute function public.lock_portfolio_transaction_owner();

drop trigger if exists portfolio_transactions_validate_insert on public.portfolio_transactions;
create trigger portfolio_transactions_validate_insert
after insert on public.portfolio_transactions
referencing new table as inserted_portfolio_transactions
for each statement execute function public.validate_inserted_portfolio_transaction_balances();

drop trigger if exists portfolio_transactions_validate_update on public.portfolio_transactions;
create trigger portfolio_transactions_validate_update
after update on public.portfolio_transactions
referencing old table as old_portfolio_transactions new table as new_portfolio_transactions
for each statement execute function public.validate_updated_portfolio_transaction_balances();

drop trigger if exists portfolio_transactions_validate_delete on public.portfolio_transactions;
create trigger portfolio_transactions_validate_delete
after delete on public.portfolio_transactions
referencing old table as deleted_portfolio_transactions
for each statement execute function public.validate_deleted_portfolio_transaction_balances();
