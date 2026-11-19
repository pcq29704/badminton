// Stadium honours: six all-time titles, computed from the club data the app already loads
// (clubQuery: `games` newest first, `ranking` best Elo first). Pure functions, no React, no three.
//
// Every game in `games` counts (ranked or not), the same as the player's profile stats.
// Only players in `ranking` (the active players) can hold an honour.
// Ties: higher Elo wins, then the name in alphabetical order.

export const FORM_GAMES = 10; // "current form" looks at this many of the player's latest games

export const HONOURS = [
  { key: "crown", title: "The Crown", label: "Top Elo", rule: "Highest Elo · at least 1 game" },
  { key: "conqueror", title: "The Conqueror", label: "Most wins", rule: "Most wins · at least 1 win" },
  { key: "unbroken", title: "The Unbroken", label: "Best win rate", rule: "Highest win % · at least 10 games" },
  { key: "relentless", title: "The Relentless", label: "Longest win streak", rule: "Most wins in a row · at least 3" },
  { key: "stalwart", title: "The Stalwart", label: "Most games played", rule: "Most games · at least 1 game" },
  { key: "rising", title: "The Rising Star", label: "Best current form", rule: `Most wins in the last ${FORM_GAMES} games · at least 5 games` },
];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// score: the number that ranks the players (higher is better). eligible: the minimum. stat: the plaque text.
const RULES = {
  crown: { eligible: (s) => s.played >= 1, score: (s) => s.elo, stat: (s) => `${s.elo} Elo` },
  conqueror: { eligible: (s) => s.wins >= 1, score: (s) => s.wins, stat: (s) => plural(s.wins, "win") },
  unbroken: {
    eligible: (s) => s.played >= 10,
    score: (s) => s.wins / s.played,
    stat: (s) => `${Math.round((s.wins / s.played) * 100)}% won · ${s.wins} of ${s.played}`,
  },
  relentless: { eligible: (s) => s.bestStreak >= 3, score: (s) => s.bestStreak, stat: (s) => `${s.bestStreak} wins in a row` },
  stalwart: { eligible: (s) => s.played >= 1, score: (s) => s.played, stat: (s) => plural(s.played, "game") + " played" },
  rising: {
    eligible: (s) => s.played >= 5,
    score: (s) => s.formWins,
    stat: (s) => `${plural(s.formWins, "win")} in the last ${s.formGames}`,
  },
};

const keyOf = (player) => {
  const username = String(player?.username || "").trim().toLowerCase();
  return username ? `u:${username}` : `n:${String(player?.name || "").trim()}`;
};

const time = (game) => {
  const t = Date.parse(game?.ended_at);
  return Number.isNaN(t) ? 0 : t;
};

// Per-player numbers for every player in the ranking: played, wins, best streak and current form.
export function playerStats(games, ranking) {
  const stats = new Map();
  for (const player of ranking || []) {
    const key = keyOf(player);
    if (stats.has(key)) continue;
    stats.set(key, {
      player: { name: player.name, username: player.username || "", elo: Math.round(Number(player.elo) || 0), tier: player.tier || "", profile_image_path: player.profile_image_path || "" },
      elo: Math.round(Number(player.elo) || 0),
      results: [], // true = win, oldest first
    });
  }
  // Oldest first, so streaks run in play order. Same end time: lower id first.
  const ordered = [...(games || [])].sort((a, b) => time(a) - time(b) || (a.id ?? 0) - (b.id ?? 0));
  for (const game of ordered) {
    if (game.winner !== "A" && game.winner !== "B") continue;
    const seen = new Set();
    for (const [team, side] of [["A", game.team_a], ["B", game.team_b]]) {
      for (const player of side || []) {
        const key = keyOf(player);
        const entry = stats.get(key);
        if (!entry || seen.has(key)) continue;
        seen.add(key);
        entry.results.push(game.winner === team);
      }
    }
  }
  for (const entry of stats.values()) {
    const { results } = entry;
    entry.played = results.length;
    entry.wins = results.filter(Boolean).length;
    let run = 0;
    entry.bestStreak = 0;
    for (const won of results) {
      run = won ? run + 1 : 0;
      entry.bestStreak = Math.max(entry.bestStreak, run);
    }
    const form = results.slice(-FORM_GAMES);
    entry.formGames = form.length;
    entry.formWins = form.filter(Boolean).length;
  }
  return [...stats.values()];
}

const byTie = (a, b) => b.elo - a.elo || String(a.player.name).localeCompare(String(b.player.name));

// The six honours, in HONOURS order. An honour nobody qualifies for has holder: null ("Unclaimed").
export function computeHonours(games, ranking) {
  const stats = playerStats(games, ranking);
  return HONOURS.map((honour) => {
    const rule = RULES[honour.key];
    const best = stats.filter(rule.eligible).sort((a, b) => rule.score(b) - rule.score(a) || byTie(a, b))[0];
    return {
      ...honour,
      holder: best ? best.player : null,
      value: best ? rule.score(best) : null,
      stat: best ? rule.stat(best) : "Unclaimed",
    };
  });
}

// The ranking wall: the top `size` rows, and a separate "You" row when the viewer is further down.
// The order is the ranking's own order, so the wall matches /ranking.
export function rankingBoard(ranking, viewer, size = 10) {
  const list = ranking || [];
  const mine = (player) => Boolean(viewer?.username) && player.username === viewer.username;
  const rows = list.slice(0, size).map((player, index) => ({ ...player, position: index + 1, me: mine(player) }));
  const index = viewer?.username ? list.findIndex(mine) : -1;
  const you = index >= size ? { ...list[index], position: index + 1, me: true } : null;
  return { rows, you };
}
