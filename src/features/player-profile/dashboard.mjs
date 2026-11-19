const MIN_DUO_GAMES = 3; // a duo or a rivalry needs this many games before it gets a label
const FORM_LENGTH = 10;
const WEEKS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CLOSE_MARGIN = 2; // a game decided by this many points or fewer is "close"
const BLOWOUT_MARGIN = 10; // a game decided by this many points or more is a blowout
const RIVALS_SHOWN = 4;

const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
const average = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const oneDecimal = (value) => (value == null ? null : Math.round(value * 10) / 10);
const rate = (entry) => (entry.games ? entry.wins / entry.games : 0);

function bump(map, key, player, won) {
  // tier and profile_image_path let the lists show the player's framed avatar.
  const entry = map.get(key) || { name: player.name, username: player.username || null, tier: player.tier || null, profile_image_path: player.profile_image_path || null, games: 0, wins: 0, losses: 0 };
  entry.games += 1;
  if (won) entry.wins += 1; else entry.losses += 1;
  map.set(key, entry);
}

const ranked = (map) => [...map.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));

// Who leads a rivalry, seen from the profile owner: "victim" (you lead), "nemesis" (they lead) or "even".
// A lead of one game counts as even. Fewer than MIN_DUO_GAMES games gives null: too early to call.
export function rivalryStatus(entry) {
  if (!entry || entry.games < MIN_DUO_GAMES) return null;
  const lead = entry.wins - entry.losses;
  if (lead > 1) return "victim";
  if (lead < -1) return "nemesis";
  return "even";
}

const numberOrNull = (value) => (value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));

// Derives dashboard numbers from a profile's finished-game history, newest first.
export function computeDashboard(history, username, now = Date.now()) {
  const games = [];
  for (const game of history || []) {
    const inA = (game.team_a || []).some((player) => same(player.username, username));
    const inB = (game.team_b || []).some((player) => same(player.username, username));
    if (inA === inB) continue;
    const mine = inA ? game.team_a : game.team_b;
    const theirs = inA ? game.team_b : game.team_a;
    const me = mine.find((player) => same(player.username, username));
    const hasScore = game.score_a != null && game.score_b != null;
    const ours = hasScore ? numberOrNull(inA ? game.score_a : game.score_b) : null;
    const against = hasScore ? numberOrNull(inA ? game.score_b : game.score_a) : null;
    const teamElo = (team) => {
      const values = team.map((player) => numberOrNull(player.elo_before));
      return values.length && values.every((value) => value != null) ? average(values) : null;
    };
    games.push({
      endedAt: game.ended_at ? new Date(game.ended_at).getTime() : null,
      won: game.winner === (inA ? "A" : "B"),
      partners: mine.filter((player) => !same(player.username, username)),
      opponents: theirs,
      score: ours != null && against != null ? { mine: ours, theirs: against } : null,
      eloBefore: numberOrNull(me?.elo_before),
      eloAfter: numberOrNull(me?.elo_after),
      myTeamElo: teamElo(mine),
      theirTeamElo: teamElo(theirs),
    });
  }
  games.sort((a, b) => (b.endedAt ?? -Infinity) - (a.endedAt ?? -Infinity));
  const oldestFirst = [...games].reverse();

  const wins = games.filter((game) => game.won).length;
  let streak = 0;
  for (const game of games) { if (!game.won) break; streak += 1; }
  let bestStreak = 0;
  let run = 0;
  for (const game of oldestFirst) { run = game.won ? run + 1 : 0; bestStreak = Math.max(bestStreak, run); }

  const partners = new Map();
  const opponents = new Map();
  for (const game of games) {
    for (const player of game.partners) bump(partners, player.username || player.name, player, game.won);
    for (const player of game.opponents) bump(opponents, player.username || player.name, player, game.won);
  }

  // Duos: partners with enough games to mean something. Worst is only shown when it differs from best.
  const duoPool = [...partners.values()].filter((entry) => entry.games >= MIN_DUO_GAMES);
  const byRate = (a, b) => rate(b) - rate(a) || b.games - a.games || a.name.localeCompare(b.name);
  const best = [...duoPool].sort(byRate)[0] || null;
  const worstCandidate = [...duoPool].sort((a, b) => byRate(b, a))[0] || null;
  const worst = worstCandidate && best && worstCandidate !== best && rate(worstCandidate) < rate(best) ? worstCandidate : null;

  const rivals = ranked(opponents).slice(0, RIVALS_SHOWN).map((entry) => ({ ...entry, status: rivalryStatus(entry) }));

  // Elo journey: the rating before the first rated game, then after every game. Oldest first.
  const rated = oldestFirst.filter((game) => game.eloAfter != null);
  const eloSeries = [];
  if (rated.length) {
    const first = rated[0];
    if (first.eloBefore != null) eloSeries.push({ elo: first.eloBefore, change: 0, won: null, at: null, start: true });
    for (const game of rated) {
      const before = game.eloBefore ?? eloSeries[eloSeries.length - 1]?.elo ?? game.eloAfter;
      eloSeries.push({ elo: game.eloAfter, change: game.eloAfter - before, won: game.won, at: game.endedAt, score: game.score });
    }
  }
  const peakElo = eloSeries.length ? Math.max(...eloSeries.map((point) => point.elo)) : null;
  const biggestGain = eloSeries.reduce((top, point) => (point.change > (top?.change ?? 0) ? point : top), null);

  // Win quality, from games that have a score.
  const scored = games.filter((game) => game.score);
  const margin = (game) => Math.abs(game.score.mine - game.score.theirs);
  const scoredWins = scored.filter((game) => game.won);
  const scoredLosses = scored.filter((game) => !game.won);
  const quality = scored.length ? {
    scored: scored.length,
    avgWinMargin: oneDecimal(average(scoredWins.map(margin))),
    avgLossMargin: oneDecimal(average(scoredLosses.map(margin))),
    closeWins: scoredWins.filter((game) => margin(game) <= CLOSE_MARGIN).length,
    closeLosses: scoredLosses.filter((game) => margin(game) <= CLOSE_MARGIN).length,
    blowoutWins: scoredWins.filter((game) => margin(game) >= BLOWOUT_MARGIN).length,
    blowoutLosses: scoredLosses.filter((game) => margin(game) >= BLOWOUT_MARGIN).length,
  } : null;
  const biggestWin = scoredWins.reduce((top, game) => (!top || margin(game) > margin(top) ? game : top), null);

  // Giant slayer: games where the other team had the higher average Elo before the game.
  const underdog = games.filter((game) => game.myTeamElo != null && game.theirTeamElo != null && game.theirTeamElo > game.myTeamElo);
  const giantSlayer = underdog.length ? { games: underdog.length, wins: underdog.filter((game) => game.won).length } : null;

  const weekly = Array.from({ length: WEEKS }, () => 0);
  for (const game of games) {
    if (game.endedAt == null) continue;
    const age = Math.floor((now - game.endedAt) / WEEK_MS);
    if (age >= 0 && age < WEEKS) weekly[WEEKS - 1 - age] += 1;
  }

  return {
    played: games.length,
    wins,
    losses: games.length - wins,
    winRate: games.length ? Math.round((wins / games.length) * 100) : null,
    streak,
    bestStreak,
    form: games.slice(0, FORM_LENGTH).map((game) => game.won),
    recent: games.slice(0, FORM_LENGTH).map((game) => ({ won: game.won, score: game.score, against: game.opponents.map((player) => player.name) })),
    duos: { best, worst },
    rivals,
    eloSeries,
    peakElo,
    quality,
    giantSlayer,
    records: {
      bestStreak,
      peakElo,
      biggestWin: biggestWin ? { margin: margin(biggestWin), score: biggestWin.score, at: biggestWin.endedAt } : null,
      biggestGain: biggestGain ? { change: biggestGain.change, at: biggestGain.at } : null,
    },
    weekly,
    activeWeeks: weekly.filter(Boolean).length,
    lastPlayed: games[0]?.endedAt ?? null,
  };
}
