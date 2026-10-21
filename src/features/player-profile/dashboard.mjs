const MIN_PARTNER_GAMES = 2;
const FORM_LENGTH = 10;
const WEEKS = 8;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const same = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();

function bump(map, key, player, won) {
  const entry = map.get(key) || { name: player.name, username: player.username || null, games: 0, wins: 0 };
  entry.games += 1;
  if (won) entry.wins += 1;
  map.set(key, entry);
}

const ranked = (map) => [...map.values()].sort((a, b) => b.games - a.games || b.wins - a.wins || a.name.localeCompare(b.name));

// Derives dashboard numbers from a profile's finished-game history, newest first.
export function computeDashboard(history, username, now = Date.now()) {
  const games = [];
  for (const game of history || []) {
    const inA = (game.team_a || []).some((player) => same(player.username, username));
    const inB = (game.team_b || []).some((player) => same(player.username, username));
    if (inA === inB) continue;
    games.push({
      endedAt: game.ended_at ? new Date(game.ended_at).getTime() : null,
      won: game.winner === (inA ? "A" : "B"),
      partners: (inA ? game.team_a : game.team_b).filter((player) => !same(player.username, username)),
      opponents: inA ? game.team_b : game.team_a,
    });
  }
  games.sort((a, b) => (b.endedAt ?? -Infinity) - (a.endedAt ?? -Infinity));

  const wins = games.filter((game) => game.won).length;
  let streak = 0;
  for (const game of games) { if (!game.won) break; streak += 1; }
  let bestStreak = 0;
  let run = 0;
  for (const game of [...games].reverse()) { run = game.won ? run + 1 : 0; bestStreak = Math.max(bestStreak, run); }

  const partners = new Map();
  const opponents = new Map();
  for (const game of games) {
    for (const player of game.partners) bump(partners, player.username || player.name, player, game.won);
    for (const player of game.opponents) bump(opponents, player.username || player.name, player, game.won);
  }
  const partnerList = ranked(partners);
  const bestPartner = partnerList
    .filter((entry) => entry.games >= MIN_PARTNER_GAMES)
    .sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games)[0] || null;

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
    partners: partnerList.slice(0, 3),
    opponents: ranked(opponents).slice(0, 3),
    bestPartner,
    weekly,
    lastPlayed: games[0]?.endedAt ?? null,
  };
}
