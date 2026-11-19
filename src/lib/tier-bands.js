// Elo needed to reach each tier, highest first. Mirrors public.tiers.min_elo in supabase/seed.sql.
// D has no minimum: it is the organiser-only starting tier, so everything under C counts as D.
export const TIER_BANDS = [
  { code: "S", min: 1475 },
  { code: "A", min: 1325 },
  { code: "B", min: 1175 },
  { code: "C", min: 1025 },
];

const D_FLOOR_GAP = 150; // how far under C the progress bar of a D player starts

// Progress to the next tier up: { next, needed, pct } or null for the top tier (or when there is no rating).
export function rankProgress(elo, tier) {
  const rating = Number(elo);
  const code = String(tier || "").toUpperCase();
  if (!Number.isFinite(rating)) return null;
  const index = TIER_BANDS.findIndex((band) => band.code === code);
  if (index === 0) return null;
  const next = index === -1 ? (code === "D" ? TIER_BANDS[TIER_BANDS.length - 1] : null) : TIER_BANDS[index - 1];
  if (!next) return null;
  const floor = index === -1 ? next.min - D_FLOOR_GAP : TIER_BANDS[index].min;
  const pct = Math.max(0, Math.min(100, Math.round(((rating - floor) / (next.min - floor)) * 100)));
  return { next: next.code, needed: Math.max(0, Math.ceil(next.min - rating)), pct };
}
