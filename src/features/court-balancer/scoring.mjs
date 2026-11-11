// Score rules and margin-of-victory Elo. The database has the same rules in
// private.score_problem and private.rate_game and recomputes on save; this file
// is for validating input and previewing the result before it is sent.

// Defaults; the settings row (target_points, cap_points, mov_min, mov_max) wins when loaded.
export const TARGET_POINTS = 21;
export const CAP_POINTS = 30;
export const MOV_MIN = 0.75;
export const MOV_MAX = 2.0;

const rules = (settings) => ({
  target: Number(settings?.target_points ?? TARGET_POINTS),
  cap: Number(settings?.cap_points ?? CAP_POINTS),
  movMin: Number(settings?.mov_min ?? MOV_MIN),
  movMax: Number(settings?.mov_max ?? MOV_MAX),
});

// Text from a score box -> whole number, or null if it isn't one ("", "1.5", "-3", "abc")
export function parseScore(text) {
  const s = String(text ?? "").trim();
  return /^\d{1,3}$/.test(s) ? Number(s) : null;
}

// Why a final score can't be right, or null when it is valid. Keep in step with private.score_problem.
export function scoreProblem(a, b, settings) {
  const { target, cap } = rules(settings);
  if (!Number.isInteger(a) || !Number.isInteger(b)) return `Enter a whole number from 0 to ${cap} for each team`;
  const w = Math.max(a, b), l = Math.min(a, b);
  if (l < 0 || w > cap) return `Scores must be between 0 and ${cap}`;
  if (w === l) return "Scores can't be tied";
  if (w < target) return `A game ends when a team reaches ${target}`;
  if (w === target && l <= target - 2) return null;
  if (w === cap && l === cap - 1) return null;
  if (l < target - 1) return `A game ends at ${target} unless it's ${target - 1}-all`;
  if (w === l + 2) return null;
  if (w === l + 1) return `At ${target - 1}-all a team needs a 2-point lead`;
  return `After ${target - 1}-all the game ends as soon as a team leads by 2`;
}

export const isValidScore = (a, b, settings) => scoreProblem(a, b, settings) === null;

// Margin multiplier M: smooth from mov_min (1-point win) up to mov_max (win by `target` points)
export function movMultiplier(a, b, settings) {
  const { target, movMin, movMax } = rules(settings);
  return movMin + (movMax - movMin) * Math.min(Math.abs(a - b) / target, 1);
}

export const expectedScore = (avgOwn, avgOther) => 1 / (1 + 10 ** ((avgOther - avgOwn) / 400));

// K for a player about to play, from their games so far
export const kFor = (gamesTotal, settings) =>
  Number((gamesTotal ?? 0) < (settings?.provisional_games ?? 10) ? settings?.k_provisional ?? 40 : settings?.k_established ?? 24);

// Elo preview. teamA/teamB: [{ id, elo, k }]. Returns the winner, M, and each player's change
// (rounded to 2 decimals, like the database).
export function eloChanges(teamA, teamB, a, b, settings) {
  const avg = (team) => team.reduce((sum, p) => sum + p.elo, 0) / team.length;
  const winner = a > b ? "A" : "B";
  const m = movMultiplier(a, b, settings);
  const expA = expectedScore(avg(teamA), avg(teamB));
  const change = (p, team) => {
    const result = team === winner ? 1 : 0;
    const expected = team === "A" ? expA : 1 - expA;
    return { id: p.id, delta: Math.round(p.k * m * (result - expected) * 100) / 100 };
  };
  return { winner, m, expectedA: expA, teamA: teamA.map((p) => change(p, "A")), teamB: teamB.map((p) => change(p, "B")) };
}

// Display only: never feeds into the Elo maths
export function resultLabel(a, b) {
  if (a == null || b == null) return "";
  const gap = Math.abs(a - b);
  return gap <= 4 ? "Close game" : gap <= 10 ? "Solid win" : "Dominant win";
}

export const formatScore = (a, b) => (a == null || b == null ? "" : `${a}–${b}`);

// +13.3 / −13.3 / ±0
export function formatDelta(d) {
  const r = Math.round(d * 10) / 10;
  return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r).toFixed(1);
}
