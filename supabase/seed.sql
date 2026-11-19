-- Starting data for the shared dev database. Safe to run more than once.
-- Tier rules and settings are the standard ones; the 23 players are a copy
-- of the prod roster as it stood on 2026-11-19 (ratings and games played included).
-- Passwords and profile images are left empty, and no sessions or games are
-- created, so the first play day starts clean.
begin;

insert into public.settings (id, tier_buffer, k_provisional, k_established, provisional_games, hold_minutes, balance_deadzone,
                             target_points, cap_points, mov_min, mov_max)
values (1, 25, 40, 24, 10, 10, 30, 21, 30, 0.75, 2.0)
on conflict (id) do update set
  tier_buffer = excluded.tier_buffer, k_provisional = excluded.k_provisional,
  k_established = excluded.k_established, provisional_games = excluded.provisional_games,
  hold_minutes = excluded.hold_minutes, balance_deadzone = excluded.balance_deadzone,
  target_points = excluded.target_points, cap_points = excluded.cap_points,
  mov_min = excluded.mov_min, mov_max = excluded.mov_max;

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
  ('Quân',              'quan', 'S', 1510.79, 50, true),
  ('Thanh',             'thanh', 'A', 1484.46, 21, true),
  ('Lewis',             'a-l-c', 'A', 1442.02, 31, true),
  ('๖ۣۜSói๖ۣۜCô๖ۣۜĐộc', 'thang', 'A', 1433.66, 69, true),
  ('Khang',             'khang', 'A', 1433.66, 72, true),
  ('Vinh',              'vinh', 'A', 1397.32, 21, true),
  ('Hiếu',              'hieu', 'A', 1386.83, 63, true),
  ('Quyền',             'quyen', 'A', 1333.55, 70, true),
  ('Đức',               'duc', 'B', 1305.01, 42, true),
  ('Grace',             'grace', 'B', 1295.19, 70, true),
  ('Hải',               'h-i', 'B', 1265.57, 30, true),
  ('Tân',               'tan', 'B', 1247.82, 20, true),
  ('Bee',               'bee', 'B', 1220.02, 73, true),
  ('Ngọc (RMIT)',       'ngoc-rmit', 'B', 1206.17, 20, true),
  ('Hannah',            'hannah', 'B', 1205.70, 20, true),
  ('Bích Phương',       'bich-phuong', 'C', 1136.26, 47, true),
  ('Như',               'nh', 'C', 1111.09, 9, true),
  ('Trung',             'trung', 'C', 1107.84, 12, true),
  ('Vy',                'vy', 'C', 1104.65, 72, true),
  ('Tâm',               'tam', 'C', 1077.18, 23, true),
  ('Lâm Thồn',          'loc', 'C', 1061.88, 72, true),
  ('Cún',               'cun', 'C', 1026.74, 50, true),
  ('Linh',              'linh', 'D', 976.33, 39, true)
on conflict (lower(trim(username))) do nothing;

alter table public.players enable trigger players_seed_elo;

commit;
