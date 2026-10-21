-- Player sign-in sessions. Rows hold a SHA-256 hash of the cookie token, never the token itself.
-- Only the service role (server route handler) reads or writes this table.
begin;

create table public.player_sessions (
  id uuid primary key default gen_random_uuid(),
  player_id bigint not null references public.players (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > created_at)
);

create index player_sessions_player_id_idx on public.player_sessions (player_id);
create index player_sessions_expires_at_idx on public.player_sessions (expires_at);

alter table public.player_sessions enable row level security;
revoke all on public.player_sessions from anon, authenticated;

commit;
