"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Object3D } from "three";
import { BANNERS, addRipple, patchGeometry } from "./bannerKit";
import { TAP_SLOP } from "./Controls";
import { drawHonourProfile } from "./HonourProfile";
import RoyalBanner from "./RoyalBanner";
import { HONOUR_Z, HONOURS_HALL, WALL } from "./constants";
import { createInfoLayer, fontsReady, loadPlayerAssets } from "./wallCanvas";

const { banner, info } = HONOURS_HALL;
const SPEC = BANNERS.honour;
const FACE_FLOOR = -Math.PI / 2; // faces −X, toward the courts; left to right runs along +Z
const P = info.pxPerMetre;
const m = (metres) => metres * P;
// One atlas for all six profiles: 3 × 2 cells, one cell per banner.
const CELL = { cols: 3, rows: 2, w: m(info.x1 - info.x0), h: m(info.y0 - info.y1) };
const cellOf = (i) => ({ cols: CELL.cols, rows: CELL.rows, col: i % CELL.cols, row: Math.floor(i / CELL.cols) });

function drawHonours(canvas, honours, assets) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  honours.forEach((honour, i) => {
    const { col, row } = cellOf(i);
    ctx.save();
    ctx.translate(col * CELL.w, row * CELL.h);
    ctx.beginPath();
    ctx.rect(0, 0, CELL.w, CELL.h);
    ctx.clip();
    drawHonourProfile(ctx, honour, { width: CELL.w, m, assets });
    ctx.restore();
  });
}

// Six royal banners over the +X barrier. Each one carries its honour on the cloth: the title under the
// header band, then the holder (avatar in a gold ring, name, rank name, stat), and the honour's crest
// near the V-bottom. A small warm spotlight on every banner. Click or tap a banner to open the holder's profile.
export default function HonoursHall({ kit, palette, honours, onOpen, sway }) {
  // Shared by all six banners: one atlas texture and material; each banner's patch uses its own cell.
  const layer = useMemo(() => {
    const l = createInfoLayer(CELL.w * CELL.cols, CELL.h * CELL.rows, kit.envMap);
    addRipple(l.material, kit.uniforms); // moves with the cloth
    return l;
  }, [kit]);
  const patches = useMemo(() => HONOUR_Z.map((_, i) => patchGeometry(SPEC, info, 12, 16, cellOf(i))), []);
  useLayoutEffect(() => () => { layer.dispose(); patches.forEach((g) => g.dispose()); }, [layer, patches]);

  const [assets, setAssets] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const holders = useMemo(() => honours.map((h) => h.holder).filter(Boolean), [honours]);
  useEffect(() => {
    let alive = true;
    fontsReady().then(() => alive && setFontsLoaded(true));
    loadPlayerAssets(holders).then((a) => alive && setAssets(a));
    return () => { alive = false; };
  }, [holders]);
  useEffect(() => {
    drawHonours(layer.canvas, honours, assets);
    layer.texture.needsUpdate = true;
  }, [layer, honours, assets, fontsLoaded]);

  // Slow sway: the banner ripple runs on a shared clock, still when the viewer prefers reduced motion.
  useFrame((_, dt) => { if (sway) kit.uniforms.uTime.value += Math.min(dt, 0.1); });

  const targets = useMemo(() => HONOUR_Z.map((z) => {
    const o = new Object3D();
    o.position.set(HONOURS_HALL.x, banner.top - banner.height * 0.5, z);
    return o;
  }), []);

  const tap = (index) => (e) => {
    e.stopPropagation(); // the floor behind never gets it
    if (e.delta > TAP_SLOP) return;
    const username = honours[index]?.holder?.username;
    if (username) onOpen(username);
  };

  return <group name="honours-hall">
    {HONOUR_Z.map((z, i) => <group key={z} onClick={tap(i)}>
      <RoyalBanner
        kit={kit}
        size="honour"
        crest={i}
        title={i}
        crestY={HONOURS_HALL.crestY}
        hookRise={0.75}
        hangTo={WALL.height + 1 - banner.top}
        position={[HONOURS_HALL.x, banner.top, z]}
        rotation-y={FACE_FLOOR}
      >
        <mesh geometry={patches[i]} material={layer.material} />
      </RoyalBanner>
    </group>)}
    {targets.map((target, i) => <group key={i}>
      <primitive object={target} />
      <spotLight position={[HONOURS_HALL.x - 7.5, 11.5, HONOUR_Z[i]]} target={target} color={palette.wallLight} angle={0.27} penumbra={0.6} intensity={5.5} decay={0} distance={20} />
    </group>)}
  </group>;
}
