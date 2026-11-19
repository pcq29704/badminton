# Profile overview: competitive widgets

Goal: the profile Overview tab should show where a player stands and who they beat, in terms a player understands.
The old "Top partners" and "Most faced" lists showed "2–2" and "3–0" with no label, and ranked by games played.

## What changed

| Before | After |
|---|---|
| Recent form (W/L only) | Recent form with the score on each token |
| Games per week bars | Removed. "Played in N of the last 8 weeks" sits in the form footer |
| Best partner (2 games minimum) | Duos: best and toughest, 3 games minimum |
| Top partners, Most faced (by games) | Rivalries: duel for the most-faced opponent plus rows "Won X · Lost Y" |
| (none) | Elo journey with tier thresholds, peak and progress to the next tier |
| (none) | Win quality: margins, close games, blowouts |
| (none) | Records and "Giant slayer" |

## Data

- `src/lib/player-api/data.ts` (`loadProfile`) now selects `elo_before` and `elo_after` from `game_players`.
- `profileResponse` (`logic.mjs`) keeps them on each player in `team_a` / `team_b`. Other fields stay an explicit allow-list.
- `computeDashboard` (`dashboard.mjs`) returns `eloSeries`, `peakElo`, `rivals`, `duos`, `quality`, `giantSlayer`, `records`, `recent`, `activeWeeks`.
  `partners`, `opponents` and `bestPartner` are gone.
- `src/lib/tier-bands.js` holds the tier thresholds for the chart and `rankProgress`.

## Rules

- Duo and rivalry labels need 3 games. A lead of 1 game counts as "Neck and neck".
- Close game: margin 2 or less. Blowout: margin 10 or more. Games without a score are skipped.
- Giant slayer: the other team's average `elo_before` is higher than yours. Needs all four ratings.
- The chart shows the latest 40 games.

## Not done

- Gap to the player directly above on the ladder and Stadium honours need the club ranking and club games on the profile page. The profile is public, so that needs a new public data source first.
- Tier thresholds are duplicated from the database seed. If `tiers.min_elo` changes, update `tier-bands.js`.

Tests: `tests/player-dashboard.test.mjs`, `tests/player-profile-logic.test.mjs`, `tests/tier-bands.test.mjs`.
