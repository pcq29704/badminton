-- =====================================================================
-- Court Balancer — Supabase schema v1
-- Run once: Supabase dashboard → SQL Editor → New query → paste → Run
--
-- Contents
--   1. Organiser access
--   2. Settings & tiers (all tunable numbers live here)
--   3. Core tables: players, sessions, session_players, courts, games,
--      game_players
--   4. Tier logic (with buffer zone)
--   5. Game functions (RPCs): start_game, remix_game, finish_game,
--      correct_result, end_session
--   6. Row Level Security
-- =====================================================================


-- =====================================================================
-- 1. ORGANISER ACCESS
-- Only users listed here can read or write anything. After your first
-- login, add yourself once (see instructions at the bottom of the file).
-- =====================================================================
create table public.organisers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_organiser()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.organisers where user_id = auth.uid());
$$;


-- =====================================================================
-- 2. SETTINGS & TIERS
-- =====================================================================
create table public.settings (
  id                int primary key default 1 check (id = 1),  -- single row
  tier_buffer       int     not null default 25,  -- buffer zone around tier edges
  k_provisional     numeric not null default 40,  -- K for a player's first games
  k_established     numeric not null default 24,  -- K afterwards
  provisional_games int     not null default 10,  -- how many games count as "new"
  hold_minutes      int     not null default 10,  -- waiting window (read by the app)
  balance_deadzone  int     not null default 30,  -- team Elo gap treated as balanced (read by the app)
  target_points     int     not null default 21,  -- a game ends at this score...
  cap_points        int     not null default 30,  -- ...unless it's deuce, up to this cap
  mov_min           numeric not null default 0.75, -- Elo multiplier for a 1-point win
  mov_max           numeric not null default 2.0,  -- multiplier for winning by target_points or more
  constraint settings_points_check check (target_points >= 2 and cap_points >= target_points),
  constraint settings_mov_check check (mov_min > 0 and mov_max >= mov_min)
);
insert into public.settings default values;

create table public.tiers (
  code           text primary key,
  rank           int  not null unique,   -- 1 = strongest
  seed_elo       int,                    -- starting Elo for new players; null = earned-only tier
  min_elo        int,                    -- lower edge of the tier; null = open-ended bottom tier
  organiser_only boolean not null default false,  -- label hidden from players (for viewer mode later)
  check (seed_elo is null or min_elo is null or seed_elo >= min_elo)
);
insert into public.tiers (code, rank, seed_elo, min_elo, organiser_only) values
  ('S', 1, null, 1475, false),
  ('A', 2, 1400, 1325, false),
  ('B', 3, 1250, 1175, false),
  ('C', 4, 1100, 1025, false),
  ('D', 5, null, null, true);


-- =====================================================================
-- 3. CORE TABLES
-- =====================================================================

-- Permanent roster. Elo and tier live here and carry across sessions.
create table public.players (
  id          bigint generated always as identity primary key,
  name        text    not null check (length(trim(name)) > 0),
  username    text    not null check (username = trim(username) and username ~ '^[A-Za-z0-9._-]{1,32}$'),
  password    text,
  profile_image_path     text,
  background_image_path  text,
  elo         numeric(8,2) not null,
  tier        text    not null references public.tiers(code),
  games_total int     not null default 0,
  active      boolean not null default true,   -- false = retired, hidden from setup
  created_at  timestamptz not null default now()
);
-- "Duc", "duc" and " Duc " count as the same name
create unique index players_name_unique on public.players (lower(trim(name)));
create unique index players_username_unique on public.players (lower(trim(username)));

-- New players: Elo is always set from their tier's starting value
create or replace function public.players_seed_elo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_seed int;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can add players';
  end if;
  select seed_elo into v_seed from tiers where code = new.tier;
  if v_seed is null then
    raise exception 'Tier % is earned-only. New players must start in a tier with a starting Elo.', new.tier;
  end if;
  new.elo := v_seed;
  new.games_total := 0;
  return new;
end;
$$;

create trigger players_seed_elo
before insert on public.players
for each row execute function public.players_seed_elo();

-- Player passwords use the explicit first-claim product flow. This function
-- locks the player row so concurrent first logins cannot claim different
-- passwords. It returns only the player's id and username.
create or replace function public.claim_player_login(p_username text, p_password text)
returns table (player_id bigint, username text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
  v_username text;
  v_saved_password text;
begin
  if p_username is null or trim(p_username) = '' or p_password is null or p_password = '' then
    return;
  end if;

  select p.id, p.username, p.password
    into v_id, v_username, v_saved_password
    from public.players p
   where lower(trim(p.username)) = lower(trim(p_username))
   for update;

  if not found then return; end if;
  if v_saved_password is null then
    update public.players set password = p_password where id = v_id;
  elsif v_saved_password <> p_password then
    return;
  end if;
  return query select v_id, v_username;
end;
$$;
revoke all on function public.claim_player_login(text, text) from public, anon, authenticated;
grant execute on function public.claim_player_login(text, text) to service_role;

-- One row per play day. Only one session can be active at a time.
-- rank_new_games is copied to each new game and does not change existing games.
create table public.sessions (
  id         bigint generated always as identity primary key,
  status     text not null default 'active' check (status in ('active', 'ended')),
  rank_new_games boolean not null default true,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  check ((status = 'ended') = (ended_at is not null))
);
create unique index one_active_session on public.sessions ((true)) where status = 'active';

-- Who is here today, and their day-only state
create table public.session_players (
  session_id     bigint not null references public.sessions(id) on delete cascade,
  player_id      bigint not null references public.players(id),
  games          int    not null default 0,   -- games played this session
  consec         int    not null default 0,   -- current back-to-back streak
  status         text   not null default 'normal' check (status in ('normal', 'keen', 'break')),
  pending_remove boolean not null default false,  -- leaving after current game
  joined_at      timestamptz not null default now(),
  left_at        timestamptz,                 -- set when they leave; row kept for history
  primary key (session_id, player_id)
);

create table public.courts (
  id              bigint generated always as identity primary key,
  session_id      bigint not null references public.sessions(id) on delete cascade,
  court_no        int    not null,            -- stable display number
  closing         boolean not null default false,
  hold_started_at timestamptz,                -- set while in the waiting window
  removed_at      timestamptz,
  unique (session_id, court_no)
);

create table public.games (
  id         bigint generated always as identity primary key,
  session_id bigint not null references public.sessions(id) on delete cascade,
  court_id   bigint not null references public.courts(id) on delete cascade,
  ranked     boolean not null default false,
  status     text not null default 'playing'
             check (status in ('playing', 'finished', 'remixed', 'abandoned')),
  winner     char(1) check (winner in ('A', 'B')),
  score_a    smallint,                 -- null for games recorded before scores were entered
  score_b    smallint,
  mov_multiplier numeric,              -- margin multiplier used for the Elo change; null if unranked or no score
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  check ((status = 'finished') = (winner is not null)),
  check ((status = 'playing')  = (ended_at is null)),
  constraint games_scores_paired check ((score_a is null) = (score_b is null)),
  constraint games_scores_finished check (score_a is null or status = 'finished'),
  constraint games_scores_winner check (
    score_a is null
    or (score_a > score_b and winner = 'A')
    or (score_b > score_a and winner = 'B'))
);
create unique index one_live_game_per_court on public.games (court_id) where status = 'playing';
create index games_session_idx on public.games (session_id, ended_at);

-- The four players in each game, with Elo before/after for undo and history
create table public.game_players (
  game_id     bigint  not null references public.games(id) on delete cascade,
  player_id   bigint  not null references public.players(id),
  team        char(1) not null check (team in ('A', 'B')),
  elo_before  numeric(8,2),
  elo_after   numeric(8,2),
  tier_before text references public.tiers(code),
  tier_after  text references public.tiers(code),
  k_used      numeric,
  primary key (game_id, player_id)
);
create index game_players_player_idx on public.game_players (player_id);


-- =====================================================================
-- 4. TIER LOGIC
-- Promote when Elo reaches (tier edge + buffer).
-- Demote when Elo falls below (current tier edge − buffer).
-- Inside the buffer, the player keeps their current tier.
-- =====================================================================
create or replace function public.next_tier(p_elo numeric, p_current text)
returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_buf int;
  v_cur tiers%rowtype;
  v_new text;
begin
  select tier_buffer into v_buf from settings where id = 1;
  select * into v_cur from tiers where code = p_current;

  -- promotion: the strongest tier above the current one we've cleared by the buffer
  select code into v_new
    from tiers
   where rank < v_cur.rank
     and min_elo is not null
     and p_elo >= min_elo + v_buf
   order by rank
   limit 1;
  if v_new is not null then
    return v_new;
  end if;

  -- demotion: fell below the current tier's edge by more than the buffer
  if v_cur.min_elo is not null and p_elo < v_cur.min_elo - v_buf then
    select code into v_new
      from tiers
     where rank > v_cur.rank
       and (min_elo is null or p_elo >= min_elo - v_buf)
     order by rank
     limit 1;
    return v_new;
  end if;

  return p_current;
end;
$$;


-- =====================================================================
-- 5. GAME FUNCTIONS (called from the app with supabase.rpc(...))
-- =====================================================================

-- Internal helpers live in the private schema, kept out of the public API.
create schema if not exists private;
grant usage on schema private to authenticated;

-- Score rule: why a final score can't be right, or null when it's valid.
-- Keep in step with scoreProblem in src/features/court-balancer/scoring.mjs.
create or replace function private.score_problem(p_a int, p_b int, p_target int, p_cap int)
returns text
language plpgsql immutable
as $$
declare
  w int := greatest(p_a, p_b);
  l int := least(p_a, p_b);
begin
  if p_a is null or p_b is null then
    return format('Enter a whole number from 0 to %s for each team', p_cap);
  end if;
  if l < 0 or w > p_cap then return format('Scores must be between 0 and %s', p_cap); end if;
  if w = l then return 'Scores can''t be tied'; end if;
  if w < p_target then return format('A game ends when a team reaches %s', p_target); end if;
  if w = p_target and l <= p_target - 2 then return null; end if;
  if w = p_cap and l = p_cap - 1 then return null; end if;
  if l < p_target - 1 then
    return format('A game ends at %s unless it''s %s-all', p_target, p_target - 1);
  end if;
  if w = l + 2 then return null; end if;
  if w = l + 1 then return format('At %s-all a team needs a 2-point lead', p_target - 1); end if;
  return format('After %s-all the game ends as soon as a team leads by 2', p_target - 1);
end;
$$;

-- Backstop so no route (RPC, table update, dashboard edit) can store an invalid score.
-- Only checks when the score changes, so tuning settings later never blocks old rows.
create or replace function private.games_check_score()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_set     settings%rowtype;
  v_problem text;
begin
  if new.score_a is null and new.score_b is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.score_a is not distinct from old.score_a
                      and new.score_b is not distinct from old.score_b then
    return new;
  end if;
  select * into v_set from settings where id = 1;
  v_problem := private.score_problem(new.score_a, new.score_b, v_set.target_points, v_set.cap_points);
  if v_problem is not null then
    raise exception 'Invalid score %-%: %', new.score_a, new.score_b, v_problem
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger games_check_score
before insert or update of score_a, score_b on public.games
for each row execute function private.games_check_score();

-- Margin multiplier from the current settings
create or replace function private.mov_multiplier(p_a int, p_b int)
returns numeric
language sql stable
set search_path = public
as $$
  select s.mov_min + (s.mov_max - s.mov_min) * least(abs(p_a - p_b)::numeric / s.target_points, 1)
    from settings s
   where s.id = 1;
$$;

-- Internal helper, kept out of the public API: rates a finished game from
-- the stored elo_before / tier_before / k_used values, scaled by the margin
-- multiplier. Used by both finish_game and correct_result so the Elo maths
-- lives in one place; calling it again replaces the old change.
create or replace function private.rate_game(p_game_id bigint, p_winner char, p_mov numeric)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_exp_a numeric;
  r       record;
  v_new   numeric;
  v_tier  text;
begin
  select 1 / (1 + power(10::numeric,
           (avg(elo_before) filter (where team = 'B')
          - avg(elo_before) filter (where team = 'A')) / 400))
    into v_exp_a
    from game_players
   where game_id = p_game_id;

  for r in
    select gp.player_id, gp.team, gp.elo_before, gp.tier_before, gp.k_used
      from game_players gp
     where gp.game_id = p_game_id
  loop
    v_new := round(
      r.elo_before + r.k_used * p_mov * (
        (case when r.team = p_winner then 1 else 0 end)
      - (case when r.team = 'A' then v_exp_a else 1 - v_exp_a end)
      ), 2);
    v_tier := next_tier(v_new, r.tier_before);

    update players set elo = v_new, tier = v_tier where id = r.player_id;
    update game_players gp
       set elo_after = v_new, tier_after = v_tier
     where gp.game_id = p_game_id and gp.player_id = r.player_id;
  end loop;
end;
$$;

-- Start a game on a court with two teams of two
create or replace function public.start_game(
  p_court_id bigint,
  p_team_a   bigint[],
  p_team_b   bigint[]
)
returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_court   courts%rowtype;
  v_all     bigint[] := p_team_a || p_team_b;
  v_game_id bigint;
  v_bad     int;
  v_ranked  boolean;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can start games';
  end if;
  if cardinality(p_team_a) <> 2 or cardinality(p_team_b) <> 2 then
    raise exception 'Each team needs exactly 2 players';
  end if;
  if (select count(distinct x) from unnest(v_all) x) <> 4 then
    raise exception 'The four players must all be different';
  end if;

  select * into v_court from courts where id = p_court_id for update;
  if not found or v_court.removed_at is not null then
    raise exception 'Court % is not available', p_court_id;
  end if;
  if v_court.closing then
    raise exception 'Court % is closing and cannot start a new game', v_court.court_no;
  end if;
  select rank_new_games into v_ranked
    from sessions where id = v_court.session_id and status = 'active' for update;
  if not found then
    raise exception 'This session has ended';
  end if;
  if exists (select 1 from games where court_id = p_court_id and status = 'playing') then
    raise exception 'Court % already has a game in progress', v_court.court_no;
  end if;

  -- all four must be present, available, and not on another court
  select count(*) into v_bad
    from unnest(v_all) as pid
   where not exists (
           select 1 from session_players sp
            where sp.session_id = v_court.session_id
              and sp.player_id  = pid
              and sp.left_at is null
              and not sp.pending_remove
              and sp.status <> 'break')
      or exists (
           select 1 from game_players gp
             join games g on g.id = gp.game_id
            where g.session_id = v_court.session_id
              and g.status = 'playing'
              and gp.player_id = pid);
  if v_bad > 0 then
    raise exception 'Some players are not available (away, on break, leaving, or already on a court)';
  end if;

  insert into games (session_id, court_id, ranked)
  values (v_court.session_id, p_court_id, v_ranked)
  returning id into v_game_id;

  insert into game_players (game_id, player_id, team)
  select v_game_id, unnest(p_team_a), 'A'
  union all
  select v_game_id, unnest(p_team_b), 'B';

  update courts set hold_started_at = null where id = p_court_id;

  -- same rule as the original app: anyone free who wasn't picked is resting,
  -- so their back-to-back streak resets
  update session_players sp
     set consec = 0
   where sp.session_id = v_court.session_id
     and sp.left_at is null
     and sp.status <> 'break'
     and not exists (
           select 1 from game_players gp
             join games g on g.id = gp.game_id
            where g.session_id = v_court.session_id
              and g.status = 'playing'
              and gp.player_id = sp.player_id);

  return v_game_id;
end;
$$;

-- Throw away a game that hasn't been played (↻ Remix). Never touches Elo.
create or replace function public.remix_game(p_game_id bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_organiser() then
    raise exception 'Only the organiser can remix games';
  end if;
  update games set status = 'remixed', ended_at = now()
   where id = p_game_id and status = 'playing';
  if not found then
    raise exception 'Game % is not in progress', p_game_id;
  end if;
end;
$$;

-- Record a result and today's game counts in one transaction.
-- Only ranked games update persistent Elo, tier, and games_total.
-- Finish a game from its score. The winner is derived from the score.
create or replace function public.finish_game(p_game_id bigint, p_score_a int, p_score_b int)
returns table (
  player_id      bigint,
  team           char,
  elo_before     numeric,
  elo_after      numeric,
  tier_before    text,
  tier_after     text,
  k_used         numeric,
  score_a        int,
  score_b        int,
  mov_multiplier numeric
)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_game    games%rowtype;
  v_set     settings%rowtype;
  v_problem text;
  v_winner  char;
  v_mov     numeric;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can record results';
  end if;
  select * into v_set from settings where id = 1;
  v_problem := private.score_problem(p_score_a, p_score_b, v_set.target_points, v_set.cap_points);
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;
  v_winner := case when p_score_a > p_score_b then 'A' else 'B' end;

  select * into v_game from games where id = p_game_id for update;
  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;
  if v_game.status <> 'playing' then
    raise exception 'Game % is not in progress (status: %)', p_game_id, v_game.status;
  end if;
  -- lock the four players, then snapshot their current rating
  perform 1 from players p
    join game_players gp on gp.player_id = p.id
   where gp.game_id = p_game_id
     for update of p;

  if v_game.ranked then
    update game_players gp
       set elo_before  = p.elo,
           tier_before = p.tier,
           k_used      = case when p.games_total < v_set.provisional_games
                              then v_set.k_provisional else v_set.k_established end
      from players p
     where p.id = gp.player_id and gp.game_id = p_game_id;

    v_mov := private.mov_multiplier(p_score_a, p_score_b);
    perform private.rate_game(p_game_id, v_winner, v_mov);

    update players p
       set games_total = p.games_total + 1
     where p.id in (select gp.player_id from game_players gp where gp.game_id = p_game_id);
  else
    update game_players gp
       set elo_before = p.elo, elo_after = p.elo,
           tier_before = p.tier, tier_after = p.tier, k_used = null
      from players p
     where p.id = gp.player_id and gp.game_id = p_game_id;
  end if;

  update session_players sp
     set games = sp.games + 1, consec = sp.consec + 1
   where sp.session_id = v_game.session_id
     and sp.player_id in (select gp.player_id from game_players gp where gp.game_id = p_game_id);

  update games g
     set status = 'finished', winner = v_winner, ended_at = now(),
         score_a = p_score_a, score_b = p_score_b, mov_multiplier = v_mov
   where g.id = p_game_id;

  return query
    select gp.player_id, gp.team, gp.elo_before, gp.elo_after, gp.tier_before, gp.tier_after,
           gp.k_used, g.score_a::int, g.score_b::int, g.mov_multiplier
      from game_players gp
      join games g on g.id = gp.game_id
     where gp.game_id = p_game_id
     order by gp.team, gp.player_id;
end;
$$;

-- Fix a wrong score (or add one to an old game). Ranked results cannot be
-- changed after one of the players finishes a later ranked game.
create or replace function public.correct_result(p_game_id bigint, p_score_a int, p_score_b int)
returns table (
  player_id      bigint,
  team           char,
  elo_before     numeric,
  elo_after      numeric,
  tier_before    text,
  tier_after     text,
  k_used         numeric,
  score_a        int,
  score_b        int,
  mov_multiplier numeric
)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_game    games%rowtype;
  v_set     settings%rowtype;
  v_problem text;
  v_winner  char;
  v_mov     numeric;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can correct results';
  end if;
  select * into v_set from settings where id = 1;
  v_problem := private.score_problem(p_score_a, p_score_b, v_set.target_points, v_set.cap_points);
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;
  v_winner := case when p_score_a > p_score_b then 'A' else 'B' end;

  select * into v_game from games where id = p_game_id for update;
  if not found or v_game.status <> 'finished' then
    raise exception 'Game % has no recorded result to correct', p_game_id;
  end if;

  if p_score_a is distinct from v_game.score_a or p_score_b is distinct from v_game.score_b then
    if v_game.ranked then
      if exists (
        select 1
          from game_players gp
          join game_players gp2 on gp2.player_id = gp.player_id and gp2.game_id <> gp.game_id
          join games g2 on g2.id = gp2.game_id
         where gp.game_id = p_game_id
           and g2.status = 'finished' and g2.ranked
           and g2.ended_at > v_game.ended_at
      ) then
        raise exception 'Too late to correct: a player from this game has already finished another ranked game';
      end if;

      perform 1 from players p
        join game_players gp on gp.player_id = p.id
       where gp.game_id = p_game_id
         for update of p;

      v_mov := private.mov_multiplier(p_score_a, p_score_b);
      perform private.rate_game(p_game_id, v_winner, v_mov);
    end if;
    update games g
       set winner = v_winner, score_a = p_score_a, score_b = p_score_b, mov_multiplier = v_mov
     where g.id = p_game_id;
  end if;

  return query
    select gp.player_id, gp.team, gp.elo_before, gp.elo_after, gp.tier_before, gp.tier_after,
           gp.k_used, g.score_a::int, g.score_b::int, g.mov_multiplier
      from game_players gp
      join games g on g.id = gp.game_id
     where gp.game_id = p_game_id
     order by gp.team, gp.player_id;
end;
$$;

-- End the play day. Unfinished games are marked abandoned (no Elo change).
create or replace function public.end_session(p_session_id bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_organiser() then
    raise exception 'Only the organiser can end a session';
  end if;
  update games set status = 'abandoned', ended_at = now()
   where session_id = p_session_id and status = 'playing';
  update courts set removed_at = coalesce(removed_at, now()), hold_started_at = null
   where session_id = p_session_id;
  update session_players set left_at = coalesce(left_at, now())
   where session_id = p_session_id;
  update sessions set status = 'ended', ended_at = now()
   where id = p_session_id and status = 'active';
  if not found then
    raise exception 'Session % is not active', p_session_id;
  end if;
end;
$$;

-- Functions: logged-in users only (each one also checks is_organiser)
revoke execute on function public.start_game(bigint, bigint[], bigint[]) from public, anon;
revoke execute on function public.remix_game(bigint)                     from public, anon;
revoke execute on function public.finish_game(bigint, int, int)            from public, anon;
revoke execute on function public.correct_result(bigint, int, int)         from public, anon;
revoke execute on function public.end_session(bigint)                    from public, anon;
revoke execute on function private.rate_game(bigint, char, numeric)      from public, anon;
revoke execute on function private.mov_multiplier(int, int)              from public, anon;
grant  execute on function public.start_game(bigint, bigint[], bigint[]) to authenticated;
grant  execute on function public.remix_game(bigint)                     to authenticated;
grant  execute on function public.finish_game(bigint, int, int)            to authenticated;
grant  execute on function public.correct_result(bigint, int, int)         to authenticated;
grant  execute on function public.end_session(bigint)                    to authenticated;
grant  execute on function private.rate_game(bigint, char, numeric)      to authenticated;
grant  execute on function private.mov_multiplier(int, int)              to authenticated;


-- =====================================================================
-- 6. ROW LEVEL SECURITY
-- Everything is organiser-only for now. A read-only viewer mode can be
-- added later through a separate view that hides Elo and shows D as C.
-- =====================================================================
alter table public.organisers      enable row level security;
alter table public.settings        enable row level security;
alter table public.tiers           enable row level security;
alter table public.players         enable row level security;
alter table public.sessions        enable row level security;
alter table public.session_players enable row level security;
alter table public.courts          enable row level security;
alter table public.games           enable row level security;
alter table public.game_players    enable row level security;

create policy "organisers see their own row" on public.organisers
  for select to authenticated using (user_id = auth.uid());

create policy "organiser full access" on public.settings
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.tiers
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.players
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.sessions
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.session_players
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.courts
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.games
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());
create policy "organiser full access" on public.game_players
  for all to authenticated using (public.is_organiser()) with check (public.is_organiser());

-- Public reads are allowed for profile images. No anon/authenticated write
-- policy is added; the player Edge Function uploads with service_role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-profile-images', 'player-profile-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);


-- =====================================================================
-- AFTER RUNNING THIS FILE
-- 1. Authentication → Sign In / Providers: keep Email enabled, and turn
--    OFF "Allow new users to sign up" once you have logged in once.
-- 2. Log in to the app once with your email (magic link), then run:
--
--      insert into public.organisers (user_id)
--      select id from auth.users where email = 'your@email.com';
-- =====================================================================
