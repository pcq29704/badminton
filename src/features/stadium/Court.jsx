"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { CanvasTexture, DoubleSide, Object3D, PlaneGeometry, RepeatWrapping } from "three";
import { CylinderCollider, RigidBody } from "@react-three/rapier";
import { BOARDS, COURT, COURT_HALF_L, COURT_HALF_W, NET } from "./constants";

// Line rectangles in court space: [x0, x1, z0, z1]. Every BWF measurement is to the line's outer edge.
function courtLines() {
  const L = COURT.line;
  const hw = COURT_HALF_W;
  const hl = COURT_HALF_L;
  const sw = COURT.singlesWidth / 2; // 2.59
  const longService = hl - COURT.doublesLongService; // 5.94
  const shortService = COURT.shortService; // 1.98
  const rects = [];
  for (const s of [-1, 1]) {
    rects.push([s * hw - (s > 0 ? L : 0), s * hw + (s < 0 ? L : 0), -hl, hl]); // doubles sideline
    rects.push([s * sw - (s > 0 ? L : 0), s * sw + (s < 0 ? L : 0), -hl, hl]); // singles sideline
  }
  for (const s of [-1, 1]) {
    const band = (outer) => (s > 0 ? [outer - L, outer] : [-outer, -outer + L]);
    rects.push([-hw, hw, ...band(hl)]); // back boundary (singles long service)
    rects.push([-hw, hw, ...band(longService)]); // doubles long service
    const near = s > 0 ? [shortService, shortService + L] : [-shortService - L, -shortService];
    rects.push([-hw, hw, ...near]); // short service
    const centre = s > 0 ? [shortService + L, hl - L] : [-hl + L, -shortService - L];
    rects.push([-L / 2, L / 2, ...centre]); // centre line
  }
  return rects;
}
const LINES = courtLines();

// Net mesh: a fine square grid on a transparent canvas, repeated across the net.
function makeNetTexture() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.fillRect(0, 0, size, 3);
  ctx.fillRect(0, 0, 3, size);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(COURT.width / 0.04, NET.depth / 0.04);
  texture.anisotropy = 4;
  return texture;
}

// The net top sags from 1.55 m at the posts to 1.524 m at the centre.
function makeNetGeometry() {
  const geometry = new PlaneGeometry(COURT.width, NET.depth, 24, 1);
  const pos = geometry.attributes.position;
  const sag = NET.postHeight - NET.centreHeight;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const t = x / COURT_HALF_W; // -1..1
    const top = NET.postHeight - sag * (1 - t * t);
    const isTop = pos.getY(i) > 0;
    pos.setY(i, isTop ? top : top - NET.depth);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

function makeTapeGeometry() {
  const geometry = new PlaneGeometry(COURT.width, NET.tape, 24, 1);
  const pos = geometry.attributes.position;
  const sag = NET.postHeight - NET.centreHeight;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) / COURT_HALF_W;
    const top = NET.postHeight - sag * (1 - t * t);
    pos.setY(i, pos.getY(i) > 0 ? top : top - NET.tape);
  }
  pos.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

const dummy = new Object3D();

export default function Court({ x, palette }) {
  const lines = useRef(null);
  const net = useMemo(() => ({ texture: makeNetTexture(), geometry: makeNetGeometry(), tape: makeTapeGeometry() }), []);
  useLayoutEffect(() => () => { net.texture.dispose(); net.geometry.dispose(); net.tape.dispose(); }, [net]);

  useLayoutEffect(() => {
    const mesh = lines.current;
    LINES.forEach(([x0, x1, z0, z1], i) => {
      dummy.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(x1 - x0, z1 - z0, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  const runoffW = (COURT_HALF_W + BOARDS.sideOffset) * 2;
  const runoffL = (COURT_HALF_L + BOARDS.endOffset) * 2;

  return <group position={[x, 0, 0]}>
    {/* run-off mat inside the boards, then the court surface, then the lines */}
    <mesh rotation-x={-Math.PI / 2} position-y={0.004}>
      <planeGeometry args={[runoffW, runoffL]} />
      <meshStandardMaterial color={palette.runoff} roughness={0.9} />
    </mesh>
    <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
      <planeGeometry args={[COURT.width, COURT.length]} />
      <meshStandardMaterial color={palette.court} roughness={0.75} />
    </mesh>
    <instancedMesh ref={lines} args={[undefined, undefined, LINES.length]} position-y={0.012} raycast={() => null}>
      <planeGeometry />
      <meshStandardMaterial color={palette.line} roughness={0.6} />
    </instancedMesh>

    {/* posts on the doubles sidelines; they block the player */}
    {[-1, 1].map((s) => <group key={s} position={[s * COURT_HALF_W, 0, 0]}>
      <mesh position-y={NET.postHeight / 2}>
        <cylinderGeometry args={[0.025, 0.025, NET.postHeight, 12]} />
        <meshStandardMaterial color={palette.post} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position-y={0.03}>
        <cylinderGeometry args={[0.16, 0.2, 0.06, 20]} />
        <meshStandardMaterial color={palette.post} metalness={0.6} roughness={0.4} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[NET.postHeight / 2, 0.12]} position={[0, NET.postHeight / 2, 0]} />
      </RigidBody>
    </group>)}

    {/* the net itself has no collider: the player walks through it */}
    <mesh geometry={net.geometry} raycast={() => null}>
      <meshStandardMaterial color={palette.netMesh} alphaMap={net.texture} transparent opacity={0.85} depthWrite={false} side={DoubleSide} roughness={1} />
    </mesh>
    <mesh geometry={net.tape} raycast={() => null}>
      <meshStandardMaterial color={palette.line} side={DoubleSide} roughness={0.6} />
    </mesh>
  </group>;
}
