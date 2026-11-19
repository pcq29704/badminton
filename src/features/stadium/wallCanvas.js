import { CanvasTexture, MeshStandardMaterial, SRGBColorSpace } from "three";
import { initials, tierKey } from "@/components/PlayerAvatar";
import { profileImageUrl } from "../player-profile/api";

// Drawing the ranking and the honours onto the banner cloth (canvas textures).
// Colours are the embroidery: cream and gold thread on the crimson velvet.

export const INK = {
  cream: "#f6ecd4",
  creamSoft: "rgba(246,236,212,0.74)",
  gold: "#e2bd62",
  goldHi: "#f5dc98",
  goldDeep: "#9c7426",
  silver: "#d6dde2",
  bronze: "#d39a68",
  crimsonInk: "#5c0b18",
  shadow: "rgba(20,0,4,0.75)",
};

// Tier metals from ui.css ([data-tier]): the no-photo disc is main → deep, like PlayerAvatar.
const TIER_METAL = {
  s: ["#8a63ff", "#26134f"], a: ["#d6a845", "#3a2a08"], b: ["#86c3cb", "#12323a"],
  c: ["#c27c4a", "#2f1b0e"], d: ["#9a6a48", "#281a10"], "": ["#d6a845", "#3a2a08"],
};

const css = (token, fallback) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback;
export const fonts = () => ({ display: css("--cb-display", '"Cormorant SC", Georgia, serif'), body: css("--cb-body", '"Be Vietnam Pro", system-ui, sans-serif') });

// Both fonts, in the weights the banners use, with Vietnamese marks.
let fontsPromise = null;
export function fontsReady() {
  if (!fontsPromise) {
    const { display, body } = fonts();
    const sample = "Hall of Ranks Ếch vồ hoa mướp Trạng nguyên múa vợt 0123456789";
    fontsPromise = Promise.all([
      document.fonts?.load(`700 64px ${display}`, sample),
      document.fonts?.load(`700 64px ${body}`, sample),
      document.fonts?.load(`600 64px ${body}`, sample),
      document.fonts?.load(`400 64px ${body}`, sample),
    ]).catch(() => null);
  }
  return fontsPromise;
}

// Images are cached by URL. Photos come from Supabase storage and load with CORS, so the canvas
// stays usable as a WebGL texture; a photo that fails falls back to the initials disc.
const images = new Map();
function loadImage(src, cors = false) {
  if (!src) return Promise.resolve(null);
  if (!images.has(src)) {
    images.set(src, new Promise((resolve) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return images.get(src);
}

// Frames, badges and photos for these players.
export async function loadPlayerAssets(players) {
  const tiers = new Set(players.map((p) => tierKey(p?.tier)).filter(Boolean));
  const photos = [...new Set(players.map((p) => p?.profile_image_path).filter(Boolean))];
  const [frames, badges, pics] = await Promise.all([
    Promise.all([...tiers].map((t) => loadImage(`/assets/profile-frames/frame-${t}.png`))),
    Promise.all([...tiers].map((t) => loadImage(`/assets/rank-badges/rank-${t}.png`))),
    Promise.all(photos.map((path) => loadImage(profileImageUrl(path), true))),
  ]);
  const byTier = (list) => Object.fromEntries([...tiers].map((t, i) => [t, list[i]]));
  return { frames: byTier(frames), badges: byTier(badges), photos: Object.fromEntries(photos.map((p, i) => [p, pics[i]])) };
}

// The framed avatar, the same as PlayerAvatar: photo (or initials disc) in the middle 58%, tier frame over it.
export function drawAvatar(ctx, cx, cy, size, player, assets) {
  const key = tierKey(player?.tier);
  const r = size * 0.29;
  const photo = assets?.photos?.[player?.profile_image_path];
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    const s = Math.max((2 * r) / photo.width, (2 * r) / photo.height);
    ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s);
  } else {
    const [main, deep] = TIER_METAL[key];
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
    g.addColorStop(0, main);
    g.addColorStop(1, deep);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${size * 0.2}px ${fonts().display}`;
    ctx.fillText(initials(player?.name), cx, cy + size * 0.01);
  }
  ctx.restore();
  const frame = assets?.frames?.[key];
  if (frame) ctx.drawImage(frame, cx - size / 2, cy - size / 2, size, size);
}

export function drawBadge(ctx, cx, cy, size, tier, assets) {
  const badge = assets?.badges?.[tierKey(tier)];
  if (badge) ctx.drawImage(badge, cx - size / 2, cy - size / 2, size, size);
}

// Shortens text with an ellipsis to fit maxWidth at the current font.
export function fit(ctx, text, maxWidth) {
  const value = String(text ?? "");
  if (ctx.measureText(value).width <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

// Shrinks the font size until the text fits (down to minSize), then ellipsis.
export function fitFont(ctx, text, weight, size, family, maxWidth, minSize = size * 0.7) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > minSize && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return fit(ctx, text, maxWidth);
}

// Embroidered text: a soft dark halo under the thread colour, so it reads on bright and dark velvet.
export function thread(ctx, text, x, y, color, blur = 6) {
  ctx.save();
  ctx.shadowColor = INK.shadow;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = blur * 0.25;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// The canvas, its texture and the material that lays it on the cloth. Lit by the banner spotlights,
// with a little self-light so the thread stays readable at the edge of the spot.
export function createInfoLayer(width, height, envMap) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new MeshStandardMaterial({
    map: texture, emissive: "#ffffff", emissiveMap: texture, emissiveIntensity: 0.32,
    transparent: true, depthWrite: false, alphaTest: 0.02, roughness: 0.55, metalness: 0.15, envMap, envMapIntensity: 0.5,
  });
  return {
    canvas,
    texture,
    material,
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
