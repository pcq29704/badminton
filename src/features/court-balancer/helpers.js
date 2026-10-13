export const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
export const matchKey = (A, B) => [pairKey(A[0], A[1]), pairKey(B[0], B[1])].sort((x, y) => x.localeCompare(y)).join("||");
export const signed = (d) => { const r = Math.round(d); return (r > 0 ? "+" : r < 0 ? "−" : "±") + Math.abs(r); };
export const usernameFromName = (name) => String(name || "").trim().toLowerCase()
  .replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "player";
export const profileHref = (username) => `/profile.html?u=${encodeURIComponent(username || "")}`;
export function fmtLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
