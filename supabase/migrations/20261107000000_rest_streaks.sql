-- Keep back-to-back streaks accurate while a whole round starts. start_game used to
-- clear the streak of anyone not on a court yet, which wiped players planned for a
-- later court. That now happens once, in reset_rest_streaks, after every game has
-- started. A player on a break also counts as resting, so their streak clears too.
-- Safe to run again.
begin;

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

  return v_game_id;
end;
$$;

-- Clear the back-to-back streak of everyone here who isn't on a court. Runs once
-- all of a round's games have started, so a player planned for a later court keeps theirs.
create or replace function public.reset_rest_streaks(p_session_id bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not is_organiser() then
    raise exception 'Only the organiser can update streaks';
  end if;
  update session_players sp
     set consec = 0
   where sp.session_id = p_session_id
     and sp.left_at is null
     and not exists (
           select 1 from game_players gp
             join games g on g.id = gp.game_id
            where g.session_id = p_session_id
              and g.status = 'playing'
              and gp.player_id = sp.player_id);
end;
$$;

revoke execute on function public.reset_rest_streaks(bigint) from public, anon;
grant  execute on function public.reset_rest_streaks(bigint) to authenticated;

commit;
