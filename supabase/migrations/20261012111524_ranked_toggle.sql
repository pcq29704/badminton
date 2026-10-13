-- Add ranked/unranked selection for future games in existing databases.
-- Existing games remain ranked; existing and new sessions start with the toggle off.
begin;

alter table public.sessions add column rank_new_games boolean not null default false;
alter table public.games add column ranked boolean not null default true;
alter table public.games alter column ranked set default false;

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

create or replace function public.finish_game(p_game_id bigint, p_winner char)
returns table (
  player_id   bigint,
  team        char,
  elo_before  numeric,
  elo_after   numeric,
  tier_before text,
  tier_after  text
)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_game games%rowtype;
  v_set  settings%rowtype;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can record results';
  end if;
  if p_winner is null or p_winner not in ('A', 'B') then
    raise exception 'Winner must be A or B';
  end if;

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
    select * into v_set from settings where id = 1;
    update game_players gp
       set elo_before  = p.elo,
           tier_before = p.tier,
           k_used      = case when p.games_total < v_set.provisional_games
                              then v_set.k_provisional else v_set.k_established end
      from players p
     where p.id = gp.player_id and gp.game_id = p_game_id;

    perform private.rate_game(p_game_id, p_winner);

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

  update games set status = 'finished', winner = p_winner, ended_at = now()
   where id = p_game_id;

  return query
    select gp.player_id, gp.team, gp.elo_before, gp.elo_after, gp.tier_before, gp.tier_after
      from game_players gp
     where gp.game_id = p_game_id
     order by gp.team, gp.player_id;
end;
$$;

create or replace function public.correct_result(p_game_id bigint, p_winner char)
returns table (
  player_id   bigint,
  team        char,
  elo_before  numeric,
  elo_after   numeric,
  tier_before text,
  tier_after  text
)
language plpgsql
set search_path = public
as $$
#variable_conflict use_column
declare
  v_game games%rowtype;
begin
  if not is_organiser() then
    raise exception 'Only the organiser can correct results';
  end if;
  if p_winner is null or p_winner not in ('A', 'B') then
    raise exception 'Winner must be A or B';
  end if;

  select * into v_game from games where id = p_game_id for update;
  if not found or v_game.status <> 'finished' then
    raise exception 'Game % has no recorded result to correct', p_game_id;
  end if;

  if v_game.winner <> p_winner then
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

      perform private.rate_game(p_game_id, p_winner);
    end if;
    update games set winner = p_winner where id = p_game_id;
  end if;

  return query
    select gp.player_id, gp.team, gp.elo_before, gp.elo_after, gp.tier_before, gp.tier_after
      from game_players gp
     where gp.game_id = p_game_id
     order by gp.team, gp.player_id;
end;
$$;

commit;
