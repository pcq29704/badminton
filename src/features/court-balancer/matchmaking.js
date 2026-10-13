import { pairKey, matchKey } from "./helpers";
const cnt = (m, k) => m.get(k) || 0;
export const W = {
  aheadSoft: 40,       // per game a player is ahead of the least-played person
  aheadHard: 300,      // extra per game beyond 1 ahead (effectively a hard block)
  streak: 15,          // per game in a player's current back-to-back streak
  keen: -350,          // ⚡ wants to play
  partnerRepeat: 45,   // per previous time this duo partnered
  matchRepeat: 45,     // per previous time this exact 2v2 happened
  olderFactor: 0.5,    // previous sessions count at half weight
  recentPartner: 120,  // these two were partners in their latest game today
  recentRematch: 500,  // this exact 2v2 was one of the last few games today
  remixAvoid: 1000,    // ↻ Remix should give a different game, not the same one
};
export const HISTORY_SESSIONS = 3; // how many previous sessions feed repeat-avoidance

const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
];

export function playingIds(state) {
  const s = new Set();
  for (const c of state.courts) {
    if (c.game) [...c.game.teamA, ...c.game.teamB].forEach((id) => s.add(id));
  }
  return s;
}

// players who can be picked for a new game right now
export function freeCandidates(state) {
  const busy = playingIds(state);
  return state.players.filter((p) => p.status !== "break" && !p.pendingRemove && !busy.has(p.id));
}

// Score how good a 2v2 split is. Balance (by Elo), then fresh partners and matchups.
function scoreGame(state, A, B, avoidKey) {
  const gap = Math.abs(A[0].elo + A[1].elo - B[0].elo - B[1].elo);
  let s = Math.max(0, gap - (state.settings?.balance_deadzone ?? 30)); // small gaps count as balanced
  const kA = pairKey(A[0].id, A[1].id);
  const kB = pairKey(B[0].id, B[1].id);
  const mk = matchKey([A[0].id, A[1].id], [B[0].id, B[1].id]);
  s += (cnt(state.partnerHist, kA) + cnt(state.partnerHist, kB)) * W.partnerRepeat;
  s += cnt(state.matchHist, mk) * W.matchRepeat;
  if (state.lastPartner.get(A[0].id) === A[1].id) s += W.recentPartner;
  if (state.lastPartner.get(B[0].id) === B[1].id) s += W.recentPartner;
  if (state.recentMatches.slice(-Math.max(2, state.courts.length)).includes(mk)) s += W.recentRematch;
  if (mk === avoidKey) s += W.remixAvoid;
  return s;
}

// Best of the 3 possible doubles splits for a fixed group of 4
function bestPairing(state, four, avoidKey) {
  let best = null;
  for (const [aIdx, bIdx] of PAIRINGS) {
    const t1 = [four[aIdx[0]], four[aIdx[1]]];
    const t2 = [four[bIdx[0]], four[bIdx[1]]];
    const s = scoreGame(state, t1, t2, avoidKey);
    if (!best || s < best.s) best = { t1, t2, s };
  }
  return best;
}

function* combos4(arr) {
  const n = arr.length;
  for (let a = 0; a < n - 3; a++)
    for (let b = a + 1; b < n - 2; b++)
      for (let c = b + 1; c < n - 1; c++)
        for (let d = c + 1; d < n; d++)
          yield [arr[a], arr[b], arr[c], arr[d]];
}

// Choose the best game from free players. Who plays: fewest games > ⚡ keen > shortest streak.
// How they split: Elo balance, then repeat-avoidance. Returns team ids, or null if < 4 free.
export function pickGame(state, avoidKey, random = Math.random) {
  const cands = freeCandidates(state);
  if (cands.length < 4) return null;
  const minGames = Math.min(...cands.map((p) => p.games));
  let best = null;
  for (const combo of combos4(cands)) {
    let fairness = 0;
    for (const p of combo) {
      const ahead = p.games - minGames;
      fairness += Math.max(0, ahead - 1) * W.aheadHard + ahead * W.aheadSoft;
      fairness += p.consec * W.streak;
      if (p.status === "keen") fairness += W.keen;
    }
    const bp = bestPairing(state, combo, avoidKey);
    const total = fairness + bp.s + random() * 5; // NOSONAR tiny noise so ties rotate
    if (!best || total < best.total) {
      best = { total, teamA: bp.t1.map((p) => p.id), teamB: bp.t2.map((p) => p.id) };
    }
  }
  return best;
}

