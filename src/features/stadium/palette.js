import { Color } from "three";

// Scene colours come from the Emerald Crown tokens in src/app/ui.css (DESIGN.md).
// The fallbacks are the same values, for the rare case the CSS is not loaded yet.
const TOKENS = {
  ground: ["--cb-ground", "#061712"],
  card: ["--cb-card", "#0a1f18"],
  cardTop: ["--cb-card-top", "#0f2c22"],
  raised: ["--cb-raised", "#133527"],
  track: ["--cb-track", "#24382f"],
  ink: ["--cb-ink", "#f2ecdc"],
  muted: ["--cb-muted", "#a9bdb2"],
  faint: ["--cb-faint", "#7f978b"],
  gold: ["--cb-gold", "#e2bd62"],
  goldHi: ["--cb-gold-hi", "#f5dc98"],
  goldDeep: ["--cb-gold-deep", "#9c7426"],
  win: ["--cb-win", "#52dc9e"],
};

export function readPalette() {
  const style = typeof document === "undefined" ? null : getComputedStyle(document.documentElement);
  const c = {};
  for (const [name, [token, fallback]] of Object.entries(TOKENS)) {
    const value = style?.getPropertyValue(token).trim();
    c[name] = new Color(value || fallback);
  }
  const mix = (a, b, t) => a.clone().lerp(b, t);
  return {
    background: c.ground.clone(),
    floor: mix(c.card, c.ground, 0.25), // dark hall floor
    runoff: c.raised.clone(), // mat under and around each court
    court: mix(c.win, c.ground, 0.58), // emerald court
    line: c.ink.clone(), // white lines
    netMesh: mix(c.ink, c.ground, 0.15),
    post: c.gold.clone(),
    board: c.cardTop.clone(),
    boardTrim: c.gold.clone(),
    barrier: c.card.clone(),
    barrierTrim: c.gold.clone(),
    tread: mix(c.track, c.ground, 0.35), // seating concrete
    step: c.faint.clone().multiplyScalar(0.55), // aisle stairs
    seat: mix(c.raised, c.win, 0.12),
    seatBack: mix(c.raised, c.win, 0.2),
    wall: c.ground.clone(),
    dome: mix(c.ground, c.card, 0.5),
    domeRib: c.goldDeep.clone(),
    lightRing: c.goldHi.clone(),
    // Phase 2: warm light on the banners (the banners bring their own crimson, cream and gold).
    wallLight: new Color("#ffd8a0"),
    player: c.gold.clone(),
    playerVisor: c.ground.clone(),
    marker: c.goldHi.clone(),
    sky: c.goldHi.clone(),
  };
}
