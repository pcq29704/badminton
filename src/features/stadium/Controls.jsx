"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { WALK_BOUNDS } from "./constants";

// Keyboard: WASD or arrows to move, Shift to run. drei matches event.key or event.code.
export const KEY_MAP = [
  { name: "forward", keys: ["KeyW", "ArrowUp"] },
  { name: "back", keys: ["KeyS", "ArrowDown"] },
  { name: "left", keys: ["KeyA", "ArrowLeft"] },
  { name: "right", keys: ["KeyD", "ArrowRight"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight", "Shift"] },
];

export function StadiumKeys({ children }) {
  return <KeyboardControls map={KEY_MAP}>{children}</KeyboardControls>;
}

// The shared movement state: the camera yaw (keys move relative to it) and the tap-to-walk point.
export function createNav() {
  return { yaw: 0, hasTarget: false, targetX: 0, targetZ: 0 };
}

// A pointer drag also ends in a click; only short presses count as a tap.
export const TAP_SLOP = 8; // pixels

const clamp = (v, max) => Math.max(-max, Math.min(max, v));

export function useFloorTap(nav) {
  return (event) => {
    event.stopPropagation(); // the first hit (court or floor) decides
    if (event.delta > TAP_SLOP) return;
    nav.targetX = clamp(event.point.x, WALK_BOUNDS.x);
    nav.targetZ = clamp(event.point.z, WALK_BOUNDS.z);
    nav.hasTarget = true;
  };
}

// A gold diamond on the floor where the player is walking to.
export function TapMarker({ nav, palette }) {
  const ref = useRef(null);
  useFrame(() => {
    const marker = ref.current;
    marker.visible = nav.hasTarget;
    if (nav.hasTarget) marker.position.set(nav.targetX, 0.03, nav.targetZ);
  });
  return <mesh ref={ref} rotation-x={-Math.PI / 2} visible={false} raycast={() => null}>
    <ringGeometry args={[0.22, 0.3, 4]} />
    <meshBasicMaterial color={palette.marker} toneMapped={false} />
  </mesh>;
}
