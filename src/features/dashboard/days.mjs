const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Groups finished games by local calendar day: newest day first, games in play order within a day.
export function groupGamesByDay(games) {
  const days = new Map();
  for (const game of games || []) {
    if (!game.ended_at) continue;
    const endedAt = new Date(game.ended_at);
    if (Number.isNaN(endedAt.getTime())) continue;
    const key = dayKey(endedAt);
    const day = days.get(key) || { key, date: new Date(endedAt.getFullYear(), endedAt.getMonth(), endedAt.getDate()), games: [] };
    day.games.push({ ...game, endedAt: endedAt.getTime() });
    days.set(key, day);
  }
  return [...days.values()].map((day) => {
    const games = day.games.sort((a, b) => a.endedAt - b.endedAt);
    const players = new Set(games.flatMap((game) => [...game.team_a, ...game.team_b].map((player) => player.username || player.name)));
    return { ...day, games, playerCount: players.size, rankedCount: games.filter((game) => game.ranked).length };
  }).sort((a, b) => b.date - a.date);
}

export const isDayKey = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
