import { pairKey, matchKey } from "./helpers";
import { formatScore, resultLabel } from "./scoring.mjs";
const cnt = (m, k) => m.get(k) || 0;
const inc = (m, k, w = 1) => m.set(k, cnt(m, k) + w);
export function recordHistory(state, teamA, teamB, weight) {
  inc(state.partnerHist, pairKey(teamA[0], teamA[1]), weight);
  inc(state.partnerHist, pairKey(teamB[0], teamB[1]), weight);
  inc(state.matchHist, matchKey(teamA, teamB), weight);
}
export function recordToday(state, teamA, teamB) {
  recordHistory(state, teamA, teamB, 1);
  state.recentMatches.push(matchKey(teamA, teamB));
  state.lastPartner.set(teamA[0], teamA[1]); state.lastPartner.set(teamA[1], teamA[0]);
  state.lastPartner.set(teamB[0], teamB[1]); state.lastPartner.set(teamB[1], teamB[0]);
}

// Turn game_players rows into a log entry. `score` is {scoreA, scoreB, mov}; old games have none.
export function makeLogEntry(state, gameId, courtNo, winner, endedAt, rows, score = {}) {
  const side = (t) => rows.filter((r) => r.team === t).map((r) => ({
    id: r.player_id,
    name: r.players?.name || state.players.find((p) => p.id === r.player_id)?.name || state.names.get(r.player_id) || "?",
    username: r.players?.username || "",
    before: Number(r.elo_before),
    after: Number(r.elo_after),
    tierBefore: r.tier_before,
    tierAfter: r.tier_after,
    k: r.k_used == null ? null : Number(r.k_used),
  }));
  return {
    gameId, courtNo, winner, endedAt, teamA: side("A"), teamB: side("B"),
    scoreA: score.scoreA ?? null, scoreB: score.scoreB ?? null, mov: score.mov == null ? null : Number(score.mov),
  };
}

// Score fields from a games row or a finish_game / correct_result row
export const scoreOf = (row) => ({ scoreA: row?.score_a ?? null, scoreB: row?.score_b ?? null, mov: row?.mov_multiplier ?? null });

// Apply new ratings returned by finish_game / correct_result
export function applyRatingRows(state, rows) {
  for (const r of rows) {
    const elo = Number(r.elo_after);
    const p = state.players.find((p) => p.id === r.player_id);
    if (p) { p.elo = elo; p.tier = r.tier_after; }
    const rp = state.roster.find((x) => x.id === r.player_id);
    if (rp) { rp.elo = elo; rp.tier = r.tier_after; }
  }
}

export function logFlags(state, e, idx) {
  const before = state.log.slice(0, idx);
  const kA = pairKey(e.teamA[0].id, e.teamA[1].id);
  const kB = pairKey(e.teamB[0].id, e.teamB[1].id);
  const mk = matchKey(e.teamA.map((p) => p.id), e.teamB.map((p) => p.id));
  const pairs = (x) => [pairKey(x.teamA[0].id, x.teamA[1].id), pairKey(x.teamB[0].id, x.teamB[1].id)];
  const repeatA = before.filter((x) => pairs(x).includes(kA)).length;
  const repeatB = before.filter((x) => pairs(x).includes(kB)).length;
  const repeatMatch = before.filter((x) => matchKey(x.teamA.map((p) => p.id), x.teamB.map((p) => p.id)) === mk).length;
  const sumA = e.teamA[0].before + e.teamA[1].before;
  const sumB = e.teamB[0].before + e.teamB[1].before;
  return { gap: Math.abs(sumA - sumB), repeatA, repeatB, repeatMatch };
}

export function logAsText(state) {
  const nm = (t, ranked) => t.map((p) => ranked
    ? `${p.name} (${Math.round(p.before)}→${Math.round(p.after)})` : p.name).join(" + ");
  const lines = state.log.map((e, i) => {
    const f = logFlags(state, e, i);
    const flags = [];
    if (f.gap > (state.settings?.balance_deadzone ?? 30)) flags.push("Elo gap " + Math.round(f.gap));
    if (f.repeatA) flags.push(`team A repeated (x${f.repeatA} before)`);
    if (f.repeatB) flags.push(`team B repeated (x${f.repeatB} before)`);
    if (f.repeatMatch) flags.push(`MATCHUP REPEATED (x${f.repeatMatch} before)`);
    const time = new Date(e.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const score = e.scoreA == null ? "" : ` ${formatScore(e.scoreA, e.scoreB)} (${resultLabel(e.scoreA, e.scoreB)})`;
    return `#${i + 1} [${time}] Court ${e.courtNo} (${e.ranked ? "Ranked" : "Unranked"}) — Team ${e.winner} won${score}\n` +
      `   A: ${nm(e.teamA, e.ranked)}\n   B: ${nm(e.teamB, e.ranked)}\n` +
      `   ${flags.length ? flags.join(", ") : "balanced, all fresh"}`;
  });
  const tally = [...state.players].sort((a, b) => b.games - a.games)
    .map((p) => `${p.name}: ${p.games} (${Math.round(p.elo)}, ${p.tier})`).join(", ");
  return `Court Balancer log — ${state.log.length} games\n\n` + lines.join("\n\n") + `\n\nToday: ${tally}`;
}

