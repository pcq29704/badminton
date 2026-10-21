-- Starting data for the shared dev database. Safe to run more than once.
-- Tier rules and settings are the standard ones; the 14 players are the dev
-- roster as it stood on 2026-10-17 (ratings and games played included).
-- Passwords and profile images are left empty, and no sessions or games are
-- created, so the first play day starts clean.
begin;

insert into public.settings (id, tier_buffer, k_provisional, k_established, provisional_games, hold_minutes, balance_deadzone)
values (1, 25, 40, 24, 10, 10, 30)
on conflict (id) do update set
  tier_buffer = excluded.tier_buffer, k_provisional = excluded.k_provisional,
  k_established = excluded.k_established, provisional_games = excluded.provisional_games,
  hold_minutes = excluded.hold_minutes, balance_deadzone = excluded.balance_deadzone;

insert into public.tiers (code, rank, seed_elo, min_elo, organiser_only) values
  ('S', 1, null, 1475, false),
  ('A', 2, 1400, 1325, false),
  ('B', 3, 1250, 1175, false),
  ('C', 4, 1100, 1025, false),
  ('D', 5, null, null, true)
on conflict (code) do update set
  rank = excluded.rank, seed_elo = excluded.seed_elo,
  min_elo = excluded.min_elo, organiser_only = excluded.organiser_only;

-- The "players_seed_elo" trigger needs an organiser login and would overwrite
-- the ratings below, so it is switched off for this insert only.
alter table public.players disable trigger players_seed_elo;

insert into public.players (name, username, tier, elo, games_total, active) values
  ('Thắng',       'thang',       'A', 1457.73,  9, true),
  ('Cún',         'cun',         'C', 1078.70,  9, true),
  ('Hiếu',        'hieu',        'S', 1477.44,  8, true),
  ('Khang',       'khang',       'A', 1364.74,  8, true),
  ('Đức',         'duc',         'A', 1398.24, 10, true),
  ('Quyền',       'quyen',       'B', 1312.14,  9, true),
  ('Grace',       'grace',       'B', 1246.53,  8, true),
  ('Ngọc RMIT',   'ngoc-rmit',   'C', 1119.88,  7, true),
  ('Bee',         'bee',         'C', 1082.09,  7, true),
  ('Lộc',         'loc',         'B', 1190.02,  9, true),
  ('Vy',          'vy',          'B', 1228.53,  9, true),
  ('Bích Phương', 'bich-phuong', 'C', 1123.31,  7, true),
  ('Tâm',         'tam',         'B', 1188.49,  7, true),
  ('Tân',         'tan',         'B', 1232.16,  9, true)
on conflict (lower(trim(username))) do nothing;

alter table public.players enable trigger players_seed_elo;

commit;
