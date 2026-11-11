-- Score-based Elo: the organiser enters both teams' points, the winner comes
-- from the score, and the Elo change is scaled by the margin of victory:
--   M = mov_min + (mov_max - mov_min) * least(margin / target_points, 1)
--   change = K * M * (result - expected)
-- Old games keep their stored Elo changes and may have no score.
-- Safe to run again: if only part of it was applied, re-running finishes the job.
begin;

-- 1. Settings: scoring rules and the margin multiplier range
alter table public.settings
  drop constraint if exists settings_points_check,
  drop constraint if exists settings_mov_check,
  add column if not exists target_points int     not null default 21,   -- a game ends at this score...
  add column if not exists cap_points    int     not null default 30,   -- ...unless it's deuce, up to this cap
  add column if not exists mov_min       numeric not null default 0.75, -- Elo multiplier for a 1-point win
  add column if not exists mov_max       numeric not null default 2.0,  -- multiplier for winning by target_points or more
  add constraint settings_points_check check (target_points >= 2 and cap_points >= target_points),
  add constraint settings_mov_check check (mov_min > 0 and mov_max >= mov_min);

-- 2. Games: the score and the multiplier that was used
alter table public.games
  drop constraint if exists games_scores_paired,
  drop constraint if exists games_scores_finished,
  drop constraint if exists games_scores_winner,
  add column if not exists score_a        smallint,
  add column if not exists score_b        smallint,
  add column if not exists mov_multiplier numeric,   -- M used for the stored Elo change; null if unranked or no score
  add constraint games_scores_paired check ((score_a is null) = (score_b is null)),
  add constraint games_scores_finished check (score_a is null or status = 'finished'),
  add constraint games_scores_winner check (
    score_a is null
    or (score_a > score_b and winner = 'A')
    or (score_b > score_a and winner = 'B'));

-- 3. Score rule: why a final score can't be right, or null when it's valid.
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

drop trigger if exists games_check_score on public.games;
create trigger games_check_score
before insert or update of score_a, score_b on public.games
for each row execute function private.games_check_score();

-- 4. Margin multiplier from the current settings
create or replace function private.mov_multiplier(p_a int, p_b int)
returns numeric
language sql stable
set search_path = public
as $$
  select s.mov_min + (s.mov_max - s.mov_min) * least(abs(p_a - p_b)::numeric / s.target_points, 1)
    from settings s
   where s.id = 1;
$$;

-- 5. Elo maths, now scaled by M. Still rates from the stored elo_before / k_used,
-- so calling it again for a correction replaces the old change instead of stacking.
drop function if exists private.rate_game(bigint, char);
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

-- 6. Finish a game from its score. The winner is derived from the score.
drop function if exists public.finish_game(bigint, char);
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

-- 7. Fix a wrong score (or add one to an old game). Ranked results cannot be
-- changed after one of the players finishes a later ranked game.
drop function if exists public.correct_result(bigint, char);
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

-- 8. Permissions: logged-in users only (each RPC also checks is_organiser).
-- score_problem stays callable by everyone: it only does arithmetic and the
-- games trigger calls it for whoever writes the row.
revoke execute on function public.finish_game(bigint, int, int)      from public, anon;
revoke execute on function public.correct_result(bigint, int, int)   from public, anon;
revoke execute on function private.rate_game(bigint, char, numeric)  from public, anon;
revoke execute on function private.mov_multiplier(int, int)          from public, anon;
grant  execute on function public.finish_game(bigint, int, int)      to authenticated;
grant  execute on function public.correct_result(bigint, int, int)   to authenticated;
grant  execute on function private.rate_game(bigint, char, numeric)  to authenticated;
grant  execute on function private.mov_multiplier(int, int)          to authenticated;

commit;
