import { pairKey, matchKey } from "./helpers.js";
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

// players who can be picked for a new game right now; `reserved` holds ids already planned for another court
export function freeCandidates(state, reserved = new Set()) {
  const busy = playingIds(state);
  return state.players.filter((p) => p.status !== "break" && !p.pendingRemove && !busy.has(p.id) && !reserved.has(p.id));
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
export function pickGame(state, avoidKey, random = Math.random, reserved = new Set()) {
  const cands = freeCandidates(state, reserved);
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

// Squared, so one terrible court costs more than several slightly-off ones
function courtCost(state, four) {
  return bestPairing(state, four).s ** 2;
}

// Swap players between courts while that lowers the round's total cost. Only moves
// people between these groups, so who plays is unchanged.
function improveRound(state, groups) {
  let moved = true;
  while (moved) {
    moved = false;
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            const before = courtCost(state, groups[a]) + courtCost(state, groups[b]);
            [groups[a][i], groups[b][j]] = [groups[b][j], groups[a][i]];
            if (courtCost(state, groups[a]) + courtCost(state, groups[b]) < before - 1e-9) moved = true;
            else [groups[a][i], groups[b][j]] = [groups[b][j], groups[a][i]];
          }
        }
      }
    }
  }
}

// Plan up to `count` courts as one round. pickGame's rules choose who plays; court by court
// the last one would be stuck with whoever is left, so the groups are then rebalanced together.
// Returns one {teamA, teamB} per court that can be filled.
export function planRound(state, count, random = Math.random) {
  const reserved = new Set();
  const groups = [];
  while (groups.length < count) {
    const pick = pickGame(state, undefined, random, reserved);
    if (!pick) break;
    const ids = [...pick.teamA, ...pick.teamB];
    ids.forEach((id) => reserved.add(id));
    groups.push(ids.map((id) => state.players.find((p) => p.id === id)));
  }
  improveRound(state, groups);
  return groups.map((four) => {
    const { t1, t2 } = bestPairing(state, four);
    return { teamA: t1.map((p) => p.id), teamB: t2.map((p) => p.id) };
  });
}

