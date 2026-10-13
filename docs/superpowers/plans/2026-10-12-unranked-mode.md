# Ranked Toggle Implementation Plan

**Goal:** New matches are unranked by default. A live toggle makes matches created while it is on ranked; changing the toggle never changes a match already created.

**Matching:** Use the existing player rotation, Elo team balance, partner history, and hold/remix rules in both modes.

## Resolved design

- Store the toggle as `sessions.rank_new_games`, default `false`, so it survives a refresh.
- Copy that value to `games.ranked` inside `start_game`. The game's saved flag controls result and correction logic. A new match after a remix uses the toggle's current value.
- An unranked finish records the winner and counts toward session rotation and matchup history. It leaves persistent `players.elo`, `players.tier`, and `players.games_total` unchanged. The last field determines the K factor for later ranked games.
- A ranked finish retains the current rating path. An unranked result correction changes only the winner. A ranked correction is blocked after a later **ranked** result for any of its players.
- Every match and log entry displays its own saved mode. Unranked results show no rating deltas. The persistent Elo still balances teams and orders the Today rating panel.
- Existing games are backfilled as ranked. Existing and newly started sessions have the toggle off by default.

## Steps and checks

1. **Database migration:** Add `sessions.rank_new_games` with default `false`. Backfill existing `games.ranked` to `true`, then set the game default to `false`. Replace `start_game` so it locks and reads the session toggle before inserting a game. Check that an old game stays ranked after the toggle changes.
2. **Result RPCs:** Branch `finish_game` on saved `games.ranked`. Both branches update `session_players.games` and `consec`; only ranked updates Elo, tier, and `players.games_total`. For unranked, store equal before/after Elo and tier snapshots. Branch `correct_result` so unranked corrections only change the winner. Check persistent player rows before and after an unranked finish and flip.
3. **Client state and controls:** Load and save the session toggle; load each game's ranked flag; add a button to the live board and a mode badge to each court. Read back the saved flag after `start_game`. Check the off → on → off sequence: existing court cards keep their modes; each new game gets the current setting; refresh restores all flags.
4. **Result UI:** Do not increment local `gamesTotal` or apply rating rows for unranked results. Keep local session counts and history updates. Hide unranked rating deltas in toast, on-screen log, and copied log. Update English/Vietnamese help and correction text. Check that a mixed session shows the right mode for every result.
5. **Regression:** Run client tests, JavaScript syntax check, and database checks when a Supabase test database is available. Cover ranked rating changes, unranked rating invariance, provisional K after unranked games, remix under the current toggle, later-result correction rules, and refresh recovery.

## Deployment and remaining external check

Apply `supabase/migrations/20261012111524_ranked_toggle.sql` before publishing the updated client. The repository has no local database running, so verify the live schema and RPC definitions match the checked-in baseline before applying the migration; then run the database checks against a test copy. No product decision remains open for this implementation.
