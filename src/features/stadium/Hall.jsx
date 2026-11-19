"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { BackSide, BufferGeometry, Float32BufferAttribute, Object3D } from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import {
  BARRIER, BOARDS, COURT_HALF_L, COURT_HALF_W, COURT_X, DOME, FLOOR, FLOOR_HALF_X, FLOOR_HALF_Z,
  HALL_HALF_X, HALL_HALF_Z, SEATS, WALL,
} from "./constants";

const dummy = new Object3D();
const noRaycast = () => null;

// Writes [x, y, z, sx, sy, sz] boxes into an instanced unit box.
function useBoxInstances(boxes) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    boxes.forEach(([x, y, z, sx, sy, sz], i) => {
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [boxes]);
  return ref;
}

function InstancedBoxes({ boxes, color, raycast, ...material }) {
  const ref = useBoxInstances(boxes);
  // Only pass raycast when set: an undefined prop would replace the mesh's own raycast method.
  return <instancedMesh ref={ref} args={[undefined, undefined, boxes.length]} {...(raycast ? { raycast } : {})}>
    <boxGeometry />
    <meshStandardMaterial color={color} {...material} />
  </instancedMesh>;
}

// ---------- seating bowl: 15 raked rows on all four sides, seat blocks with stairs between ----------
const treadY = (row) => SEATS.firstTread + row * SEATS.rise;

function buildBowl() {
  const T = BARRIER.thickness;
  const D = SEATS.rowDepth;
  const risers = [];
  const seats = [];
  const backs = [];
  const steps = [];
  // Each side: the axis the rows run along, the floor edge it starts at, and its seat blocks.
  const sides = [
    { along: "x", half: FLOOR_HALF_X, edge: FLOOR_HALF_Z, blocks: SEATS.blocksLong },
    { along: "z", half: FLOOR_HALF_Z, edge: FLOOR_HALF_X, blocks: SEATS.blocksShort },
  ];
  for (const side of sides) {
    const blockLen = (side.half * 2 - (side.blocks - 1) * SEATS.aisle) / side.blocks;
    const perBlock = Math.floor(blockLen / SEATS.pitch);
    for (const s of [-1, 1]) {
      // place(a, d, y, sa, sy, sd): a = along the row, d = distance out from the floor edge
      const place = (list, a, d, y, sa, sy, sd) => {
        const out = s * (side.edge + d);
        list.push(side.along === "x" ? [a, y, out, sa, sy, sd] : [out, y, a, sd, sy, sa]);
      };
      for (let row = 0; row < SEATS.rows; row++) {
        const front = T + row * D;
        const h = treadY(row);
        // Risers are rectangular rings: the long sides run into the corners, the short sides stop at them.
        const ringHalf = side.along === "x" ? FLOOR_HALF_X + T + (row + 1) * D : FLOOR_HALF_Z + T + row * D;
        place(risers, 0, front + D / 2, h / 2, ringHalf * 2, h, D);
        for (let b = 0; b < side.blocks; b++) {
          const start = -side.half + b * (blockLen + SEATS.aisle) + (blockLen - perBlock * SEATS.pitch) / 2;
          for (let k = 0; k < perBlock; k++) {
            const a = start + (k + 0.5) * SEATS.pitch;
            place(seats, a, front + 0.33, h + 0.21, 0.44, 0.42, 0.42);
            place(backs, a, front + 0.57, h + 0.62, 0.44, 0.4, 0.06);
          }
          // a half step on the back half of the tread, up to the next row
          if (b > 0 && row < SEATS.rows - 1) {
            const aisle = -side.half + b * (blockLen + SEATS.aisle) - SEATS.aisle / 2;
            place(steps, aisle, front + D * 0.75, h + SEATS.rise / 4, SEATS.aisle - 0.1, SEATS.rise / 2, D / 2);
          }
        }
      }
    }
  }
  return { risers, seats, backs, steps };
}

function SeatingBowl({ palette }) {
  const bowl = useMemo(buildBowl, []);
  return <group>
    <InstancedBoxes boxes={bowl.risers} color={palette.tread} roughness={0.95} />
    <InstancedBoxes boxes={bowl.steps} color={palette.step} roughness={0.9} raycast={noRaycast} />
    <InstancedBoxes boxes={bowl.seats} color={palette.seat} roughness={0.8} raycast={noRaycast} />
    <InstancedBoxes boxes={bowl.backs} color={palette.seatBack} roughness={0.8} raycast={noRaycast} />
  </group>;
}

// ---------- barrier wall between the floor and the first row ----------
function Barrier({ palette }) {
  const T = BARRIER.thickness;
  const H = BARRIER.height;
  const walls = useMemo(() => [
    [0, H / 2, -(FLOOR_HALF_Z + T / 2), (FLOOR_HALF_X + T) * 2, H, T],
    [0, H / 2, FLOOR_HALF_Z + T / 2, (FLOOR_HALF_X + T) * 2, H, T],
    [-(FLOOR_HALF_X + T / 2), H / 2, 0, T, H, FLOOR_HALF_Z * 2],
    [FLOOR_HALF_X + T / 2, H / 2, 0, T, H, FLOOR_HALF_Z * 2],
  ], [H, T]);
  const trims = useMemo(() => walls.map(([x, , z, sx, , sz]) => [x, H + 0.02, z, sx + 0.02, 0.04, sz + 0.02]), [walls, H]);
  // Colliders are thick and tall, so the player can never squeeze or step through.
  const pad = 1;
  return <>
    <InstancedBoxes boxes={walls} color={palette.barrier} roughness={0.85} />
    <InstancedBoxes boxes={trims} color={palette.barrierTrim} metalness={0.5} roughness={0.35} raycast={noRaycast} />
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[FLOOR_HALF_X + pad * 2, 2, pad]} position={[0, 2, -(FLOOR_HALF_Z + pad)]} />
      <CuboidCollider args={[FLOOR_HALF_X + pad * 2, 2, pad]} position={[0, 2, FLOOR_HALF_Z + pad]} />
      <CuboidCollider args={[pad, 2, FLOOR_HALF_Z + pad * 2]} position={[-(FLOOR_HALF_X + pad), 2, 0]} />
      <CuboidCollider args={[pad, 2, FLOOR_HALF_Z + pad * 2]} position={[FLOOR_HALF_X + pad, 2, 0]} />
    </RigidBody>
  </>;
}

// ---------- low boards around each court, with walk-in gaps at the corners and level with the net ----------
function boardSegments() {
  const hx = COURT_HALF_W + BOARDS.sideOffset;
  const hz = COURT_HALF_L + BOARDS.endOffset;
  const t = BOARDS.thickness;
  const segments = [];
  for (const cx of COURT_X) {
    const endLen = (hx - BOARDS.cornerGap) * 2;
    for (const s of [-1, 1]) segments.push([cx, s * hz, endLen, t]); // behind each baseline
    const sideLen = hz - BOARDS.cornerGap - BOARDS.netGap;
    const sideMid = BOARDS.netGap + sideLen / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) segments.push([cx + sx * hx, sz * sideMid, t, sideLen]);
  }
  return segments; // [x, z, sizeX, sizeZ]
}

function Boards({ palette }) {
  const segments = useMemo(boardSegments, []);
  const H = BOARDS.height;
  const panels = useMemo(() => segments.map(([x, z, sx, sz]) => [x, H / 2, z, sx, H, sz]), [segments, H]);
  const trims = useMemo(() => segments.map(([x, z, sx, sz]) => [x, H - 0.05, z, sx + 0.01, 0.06, sz + 0.01]), [segments, H]);
  return <>
    <InstancedBoxes boxes={panels} color={palette.board} roughness={0.7} />
    <InstancedBoxes boxes={trims} color={palette.boardTrim} metalness={0.4} roughness={0.4} raycast={noRaycast} />
    <RigidBody type="fixed" colliders={false}>
      {segments.map(([x, z, sx, sz], i) => <CuboidCollider key={i} args={[sx / 2 + 0.02, 1, sz / 2 + 0.02]} position={[x, 1, z]} />)}
    </RigidBody>
  </>;
}

// ---------- outer walls ----------
function OuterWalls({ palette }) {
  const W = WALL.thickness;
  const H = WALL.height;
  const walls = useMemo(() => [
    [0, H / 2, -HALL_HALF_Z, HALL_HALF_X * 2 + W, H, W],
    [0, H / 2, HALL_HALF_Z, HALL_HALF_X * 2 + W, H, W],
    [-HALL_HALF_X, H / 2, 0, W, H, HALL_HALF_Z * 2],
    [HALL_HALF_X, H / 2, 0, W, H, HALL_HALF_Z * 2],
  ], [H, W]);
  return <>
    <InstancedBoxes boxes={walls} color={palette.wall} roughness={1} />
    <RigidBody type="fixed" colliders={false}>
      {walls.map(([x, y, z, sx, sy, sz], i) => <CuboidCollider key={i} args={[sx / 2, sy / 2, sz / 2]} position={[x, y, z]} />)}
    </RigidBody>
  </>;
}

// ---------- dome, structure ribs, light rings and spot fixtures ----------
function ellipsoidPoint(theta, phi) {
  // theta from the top (0) to the base (pi/2), phi around
  const r = Math.sin(theta);
  return [DOME.radiusX * r * Math.cos(phi), DOME.baseY + DOME.rise * Math.cos(theta), DOME.radiusZ * r * Math.sin(phi)];
}

function makeRibs() {
  const points = [];
  const meridians = 20;
  const steps = 24;
  for (let m = 0; m < meridians; m++) {
    const phi = (m / meridians) * Math.PI * 2;
    for (let i = 0; i < steps; i++) points.push(...ellipsoidPoint((i / steps) * Math.PI / 2, phi), ...ellipsoidPoint(((i + 1) / steps) * Math.PI / 2, phi));
  }
  for (const theta of [0.5, 0.8, 1.1, 1.35]) {
    const n = 96;
    for (let i = 0; i < n; i++) points.push(...ellipsoidPoint(theta, (i / n) * Math.PI * 2), ...ellipsoidPoint(theta, ((i + 1) / n) * Math.PI * 2));
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(points.map((v, i) => (i % 3 === 1 ? v - 0.05 : v)), 3));
  return geometry;
}

const RINGS = [0.62, 0.95]; // theta of the two light rings

function Dome({ palette }) {
  const ribs = useMemo(makeRibs, []);
  useLayoutEffect(() => () => ribs.dispose(), [ribs]);
  const fixtures = useMemo(() => {
    const out = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = ellipsoidPoint(RINGS[1], (i / n) * Math.PI * 2);
      out.push([x * 0.97, y - 0.5, z * 0.97, 0.7, 0.35, 0.7]);
    }
    return out;
  }, []);
  return <group>
    <mesh scale={[DOME.radiusX, DOME.rise, DOME.radiusZ]} position-y={DOME.baseY} raycast={noRaycast}>
      <sphereGeometry args={[1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshStandardMaterial color={palette.dome} side={BackSide} roughness={1} />
    </mesh>
    <lineSegments geometry={ribs} raycast={noRaycast}>
      <lineBasicMaterial color={palette.domeRib} transparent opacity={0.55} />
    </lineSegments>
    {RINGS.map((theta) => {
      const r = Math.sin(theta);
      return <mesh key={theta} rotation-x={-Math.PI / 2} position-y={DOME.baseY + DOME.rise * Math.cos(theta) - 0.3} scale={[DOME.radiusX * r * 0.97, DOME.radiusZ * r * 0.97, 1]} raycast={noRaycast}>
        <ringGeometry args={[0.985, 1, 128]} />
        <meshBasicMaterial color={palette.lightRing} side={BackSide} toneMapped={false} />
      </mesh>;
    })}
    <InstancedBoxes boxes={fixtures} color={palette.lightRing} emissive={palette.lightRing} emissiveIntensity={1.5} raycast={noRaycast} />
  </group>;
}

// ---------- the hall ----------
// Clicks on the floor or a court walk the player there (onFloorTap). Clicks that land on the stands stop here.
export default function Hall({ palette, onFloorTap, children }) {
  const stop = (event) => event.stopPropagation();
  return <>
    <group onClick={onFloorTap}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[FLOOR.width, FLOOR.depth]} />
        <meshStandardMaterial color={palette.floor} roughness={0.85} />
      </mesh>
      {children}
    </group>
    <group onClick={stop}>
      <Boards palette={palette} />
      <Barrier palette={palette} />
      <SeatingBowl palette={palette} />
      <OuterWalls palette={palette} />
    </group>
    <Dome palette={palette} />
  </>;
}
