-- Rank every new game by default. The unranked toggle is hidden in the UI for now.
-- Games already played keep their stored ranked value.

alter table public.sessions alter column rank_new_games set default true;
update public.sessions set rank_new_games = true where rank_new_games = false;
