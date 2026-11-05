export const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
export const matchKey = (A, B) => [pairKey(A[0], A[1]), pairKey(B[0], B[1])].sort((x, y) => x.localeCompare(y)).join("||");
export const signed = (d) => { const r = Math.round(d); return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r); };
export const usernameFromName = (name) => String(name || "").trim().toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "player";
export const profileHref = (username) => `/profile?u=${encodeURIComponent(username || "")}`;
export function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

// Stats and Log panels and raw ratings are for debugging only: open the app with ?debug.
export const isDebug = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

// Win streaks, worked out from today's log
export const STREAK_MIN = 3; // wins in a row before a streak is celebrated
// Win streak per player after the first `upTo` games of today's log
export function winStreaks(log, upTo = log.length) {
  const m = new Map();
  for (const e of log.slice(0, upTo)) {
    const [win, lose] = e.winner === "A" ? [e.teamA, e.teamB] : [e.teamB, e.teamA];
    for (const p of win) m.set(p.id, (m.get(p.id) || 0) + 1);
    for (const p of lose) m.set(p.id, 0);
  }
  return m;
}
export const streakIcon = (n) => (n >= 5 ? "👑" : n >= 4 ? "🔥" : n >= STREAK_MIN ? "⭐" : "");
