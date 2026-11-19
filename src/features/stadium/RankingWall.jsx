"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Object3D } from "three";
import { tierKey } from "@/components/PlayerAvatar";
import { RANK_NAMES } from "@/lib/rank-names";
import { BANNERS, CREST_RANKING, patchGeometry } from "./bannerKit";
import { TAP_SLOP } from "./Controls";
import RoyalBanner from "./RoyalBanner";
import { RANKING_WALL, WALL } from "./constants";
import { INK, createInfoLayer, drawAvatar, drawBadge, fit, fitFont, fonts, fontsReady, loadPlayerAssets, thread } from "./wallCanvas";

const { banner, info } = RANKING_WALL;
const SPEC = BANNERS.ranking;
const P = info.pxPerMetre;
const m = (metres) => metres * P;
const WIDTH = info.x1 - info.x0; // 8.56 m
const HEIGHT = info.y0 - info.y1; // 4.35 m

// Layout on the cloth, in metres from the info patch's top-left corner.
const L = {
  title: { y: 0.06, h: 0.68, w: 4.1 }, // cream cartouche in the header band
  cols: { y: 0.96 },
  rows: { y: 1.12, h: 0.52 },
  you: { y: 3.8, h: 0.5 },
  colGap: 0.4,
};
const COL_W = (WIDTH - L.colGap) / 2;
const PODIUM = { 1: INK.gold, 2: INK.silver, 3: INK.bronze };

function drawCrown(ctx, cx, cy, w) {
  const h = w * 0.62;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + h / 2);
  ctx.lineTo(cx - w / 2 - w * 0.04, cy - h * 0.3);
  ctx.lineTo(cx - w * 0.22, cy + h * 0.05);
  ctx.lineTo(cx, cy - h / 2);
  ctx.lineTo(cx + w * 0.22, cy + h * 0.05);
  ctx.lineTo(cx + w / 2 + w * 0.04, cy - h * 0.3);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.closePath();
  ctx.fillStyle = INK.gold;
  ctx.fill();
}

// One row: position, framed avatar, name and rank name, tier badge, Elo.
function drawRow(ctx, row, x, y, w, h, { hovered, assets, you = false }) {
  const { display, body } = fonts();
  const mid = y + h / 2;
  if (row.me || hovered) {
    ctx.fillStyle = hovered ? (row.me ? "rgba(226,189,98,0.34)" : "rgba(246,236,212,0.16)") : "rgba(226,189,98,0.2)";
    ctx.fillRect(x, y + 3, w, h - 6);
  }
  const place = PODIUM[row.position];
  // position (crown over #1)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${m(0.3)}px ${display}`;
  if (row.position === 1) drawCrown(ctx, x + m(0.21), y + m(0.1), m(0.16));
  thread(ctx, String(row.position), x + m(0.21), mid + (row.position === 1 ? m(0.06) : 0), place ?? INK.creamSoft);
  // avatar
  drawAvatar(ctx, x + m(0.68), mid, m(0.48), row, assets);
  // name and rank name
  const nameX = x + m(0.98);
  const nameW = w - m(0.98) - m(1.22);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const label = `${row.name}${row.me ? " (you)" : ""}`;
  const name = fitFont(ctx, label, 700, m(0.2), body, nameW);
  thread(ctx, name, nameX, mid + m(0.02), row.me ? INK.goldHi : INK.cream);
  const tier = tierKey(row.tier).toUpperCase();
  if (tier) {
    ctx.font = `400 ${m(0.1)}px ${body}`;
    thread(ctx, fit(ctx, RANK_NAMES[tier], nameW), nameX, mid + m(0.16), INK.creamSoft, 4);
  }
  // tier badge and Elo
  drawBadge(ctx, x + w - m(0.98), mid, m(0.44), row.tier, assets);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${m(0.27)}px ${display}`;
  thread(ctx, String(Math.round(row.elo)), x + w - m(0.06), mid, row.position === 1 ? INK.goldHi : INK.cream);
  // gold thread line under the row
  if (!you) {
    ctx.fillStyle = "rgba(226,189,98,0.28)";
    ctx.fillRect(x, y + h - 2, w, 2);
  }
}

// Draws the whole ranking on the canvas and returns the rows' hit boxes (canvas px).
function drawRanking(canvas, { rows, you, hovered }, assets) {
  const ctx = canvas.getContext("2d");
  const { display, body } = fonts();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const hits = [];

  // title on a cream cartouche in the header band, edged in gold
  const tw = m(L.title.w);
  const tx = (canvas.width - tw) / 2;
  const ty = m(L.title.y);
  const th = m(L.title.h);
  ctx.fillStyle = "#efe2c2";
  ctx.fillRect(tx, ty, tw, th);
  ctx.strokeStyle = INK.gold;
  ctx.lineWidth = m(0.035);
  ctx.strokeRect(tx + m(0.03), ty + m(0.03), tw - m(0.06), th - m(0.06));
  ctx.lineWidth = m(0.012);
  ctx.strokeRect(tx + m(0.075), ty + m(0.075), tw - m(0.15), th - m(0.15));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${m(0.44)}px ${display}`;
  ctx.fillStyle = INK.crimsonInk;
  ctx.fillText("Hall of Ranks", canvas.width / 2, ty + th / 2 + m(0.02));
  for (const s of [-1, 1]) { // gold diamonds either side
    const dx = canvas.width / 2 + s * (tw / 2 - m(0.28));
    ctx.save();
    ctx.translate(dx, ty + th / 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = INK.goldDeep;
    ctx.fillRect(-m(0.06), -m(0.06), m(0.12), m(0.12));
    ctx.restore();
  }

  if (!rows.length) {
    ctx.font = `600 ${m(0.42)}px ${display}`;
    thread(ctx, "No players yet", canvas.width / 2, m(2.4), INK.cream, 10);
    return hits;
  }

  // column heads
  ctx.font = `600 ${m(0.1)}px ${body}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${m(0.02)}px`;
  for (let c = 0; c < (rows.length > 5 ? 2 : 1); c++) {
    const x = c * m(COL_W + L.colGap);
    const w = m(COL_W);
    const y = m(L.cols.y);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    thread(ctx, "#", x + m(0.21), y, INK.goldHi, 3);
    ctx.textAlign = "left";
    thread(ctx, "PLAYER", x + m(0.44), y, INK.goldHi, 3);
    ctx.textAlign = "center";
    thread(ctx, "TIER", x + w - m(0.98), y, INK.goldHi, 3);
    ctx.textAlign = "right";
    thread(ctx, "ELO", x + w - m(0.06), y, INK.goldHi, 3);
    ctx.fillStyle = "rgba(226,189,98,0.6)";
    ctx.fillRect(x, y + m(0.09), w, 3);
  }
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // top 10: 1-5 left, 6-10 right
  rows.forEach((row, i) => {
    const c = Math.floor(i / 5);
    const x = c * m(COL_W + L.colGap);
    const y = m(L.rows.y + (i % 5) * L.rows.h);
    drawRow(ctx, row, x, y, m(COL_W), m(L.rows.h), { hovered: hovered === i, assets });
    hits.push({ id: i, x, y, w: m(COL_W), h: m(L.rows.h) });
  });

  // "You": the viewer's own place when it is below the top 10, under a double gold rule
  if (you) {
    const w = m(COL_W);
    const x = (canvas.width - w) / 2;
    const y = m(L.you.y);
    ctx.fillStyle = INK.gold;
    ctx.fillRect(x, y - m(0.05), w, 3);
    ctx.fillRect(x, y - m(0.05) + 9, w, 3);
    drawRow(ctx, you, x, y, w, m(L.you.h), { hovered: hovered === "you", assets, you: true });
    hits.push({ id: "you", x, y, w, h: m(L.you.h) });
  }
  return hits;
}

// The ranking wall at the scoreboard end: a large royal banner over the end barrier with the live
// ranking drawn on its cloth: "Hall of Ranks", the top 10, and a "You" row when the viewer is further down.
// Hover a row to pick it for the E key; click or tap a row to open that player's profile.
export default function RankingWall({ kit, palette, rows, you, onHover, onOpen }) {
  const connected = useThree((s) => s.events.connected);
  const layer = useMemo(() => createInfoLayer(m(WIDTH), m(HEIGHT), kit.envMap), [kit]);
  const geometry = useMemo(() => patchGeometry(SPEC, info, 48, 24), []);
  useLayoutEffect(() => () => { layer.dispose(); geometry.dispose(); }, [layer, geometry]);

  const [assets, setAssets] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [hovered, setHovered] = useState(null);
  const hits = useRef([]);
  const players = useMemo(() => (you ? [...rows, you] : rows), [rows, you]);

  useEffect(() => {
    let alive = true;
    fontsReady().then(() => alive && setFontsLoaded(true));
    loadPlayerAssets(players).then((a) => alive && setAssets(a));
    return () => { alive = false; };
  }, [players]);

  useEffect(() => {
    hits.current = drawRanking(layer.canvas, { rows, you, hovered }, assets);
    layer.texture.needsUpdate = true;
  }, [layer, rows, you, hovered, assets, fontsLoaded]);

  const rowFor = (id) => (id === "you" ? you : rows[id]) ?? null;
  const hitAt = (uv) => {
    if (!uv) return null;
    const x = uv.x * layer.canvas.width;
    const y = (1 - uv.y) * layer.canvas.height;
    return hits.current.find((h) => x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h)?.id ?? null;
  };
  const setHover = (id) => {
    if (id === hovered) return;
    setHovered(id);
    const row = id == null ? null : rowFor(id);
    onHover(row);
    if (connected) connected.style.cursor = row?.username ? "var(--cursor-hit, pointer)" : "";
  };

  // Warm, narrow spotlight on the banner from the roof above the floor.
  const target = useMemo(() => {
    const o = new Object3D();
    o.position.set(0, banner.top - banner.height * 0.45, RANKING_WALL.z);
    return o;
  }, []);

  return <group name="ranking-wall">
    <RoyalBanner
      kit={kit}
      size="ranking"
      crest={CREST_RANKING}
      crestY={RANKING_WALL.crestY}
      hookRise={0.9}
      hangTo={WALL.height + 2 - banner.top}
      position={[0, banner.top, RANKING_WALL.z]}
    >
      <mesh
        geometry={geometry}
        material={layer.material}
        onPointerMove={(e) => { e.stopPropagation(); setHover(hitAt(e.uv)); }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation(); // the floor behind never gets it
          if (e.delta > TAP_SLOP) return;
          const row = rowFor(hitAt(e.uv));
          if (row?.username) onOpen(row.username);
        }}
      />
    </RoyalBanner>
    <primitive object={target} />
    <spotLight position={[0, 12.6, -3]} target={target} color={palette.wallLight} angle={0.42} penumbra={0.55} intensity={2.8} decay={0} distance={40} />
  </group>;
}
