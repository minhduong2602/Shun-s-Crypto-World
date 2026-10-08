create table if not exists public.telegram_link_tokens (
  owner_id uuid not null references auth.users(id) on delete cascade,
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists telegram_link_tokens_owner_created_idx
  on public.telegram_link_tokens (owner_id, created_at desc);

alter table public.telegram_link_tokens enable row level security;
revoke all on public.telegram_link_tokens from public, anon, authenticated;
grant all on public.telegram_link_tokens to service_role;

create or replace function public.complete_telegram_link(p_token_hash text, p_chat_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_owner uuid;
begin
  if p_token_hash !~ '^[a-f0-9]{64}$' or p_chat_id !~ '^-?[0-9]{1,24}$' then
    return false;
  end if;

  update public.telegram_link_tokens
  set consumed_at = timezone('utc', now())
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > timezone('utc', now())
  returning owner_id into linked_owner;

  if linked_owner is null then
    return false;
  end if;

  insert into public.user_settings (owner_id, telegram_chat_id, telegram_alerts_enabled)
  values (linked_owner, p_chat_id, true)
  on conflict (owner_id) do update
    set telegram_chat_id = excluded.telegram_chat_id,
        telegram_alerts_enabled = true,
        updated_at = timezone('utc', now());

  return true;
end;
$$;

revoke all on function public.complete_telegram_link(text, text) from public, anon, authenticated;
grant execute on function public.complete_telegram_link(text, text) to service_role;
