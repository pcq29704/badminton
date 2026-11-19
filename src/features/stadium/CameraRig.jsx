"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CAMERA, SPAWN } from "./constants";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// How much of the flat offset (ox, oz) from (tx, tz) fits inside the camera box (0..1).
// The box is the floor area under the dome, so the camera never enters the seats or reaches the dome.
function fitFlat(tx, tz, ox, oz) {
  let t = 1;
  const limit = (from, off, max) => {
    if (off > 0 && from + off * t > max) t = (max - from) / off;
    if (off < 0 && from + off * t < -max) t = (-max - from) / off;
  };
  limit(tx, ox, CAMERA.boundX);
  limit(tz, oz, CAMERA.boundZ);
  return clamp(t, 0, 1);
}

// Third-person follow camera. Drag (mouse or one finger) orbits, the wheel or a two-finger pinch zooms.
// Writes the yaw to nav so the keys move relative to the view.
export default function CameraRig({ nav, state }) {
  const camera = useThree((s) => s.camera);
  // The element R3F listens on (the canvas wrapper), so drags and R3F clicks share one source.
  const canvas = useThree((s) => s.gl.domElement);
  const connected = useThree((s) => s.events.connected);
  const dom = connected || canvas.parentElement;
  const view = useRef({ yaw: 0, pitch: CAMERA.pitch, distance: CAMERA.distance, ready: false }).current;
  const drag = useRef({ id: -1, x: 0, y: 0 }).current;

  useEffect(() => {
    // Touch: two fingers pinch to zoom (the wheel does it on desktop). A second finger ends the orbit drag.
    const touches = new Map();
    const spread = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    let pinchFrom = 0;
    const down = (e) => {
      if (e.pointerType === "touch") {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2) {
          drag.id = -1;
          pinchFrom = spread();
          return;
        }
      }
      if (drag.id !== -1) return;
      drag.id = e.pointerId;
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const moveTo = (e) => {
      if (touches.has(e.pointerId)) {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touches.size === 2 && pinchFrom > 0) {
          const now = spread();
          view.distance = clamp(view.distance * (pinchFrom / Math.max(now, 1)), CAMERA.minDistance, CAMERA.maxDistance);
          pinchFrom = now;
          return;
        }
      }
      if (e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      view.yaw -= dx * 0.006;
      view.pitch = clamp(view.pitch + dy * 0.005, CAMERA.minPitch - CAMERA.maxLookUp, CAMERA.maxPitch);
    };
    const up = (e) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinchFrom = 0;
      if (e.pointerId === drag.id) drag.id = -1;
    };
    const wheel = (e) => {
      e.preventDefault();
      view.distance = clamp(view.distance * Math.exp(e.deltaY * 0.001), CAMERA.minDistance, CAMERA.maxDistance);
    };
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", moveTo);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    dom.addEventListener("wheel", wheel, { passive: false });
    return () => {
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", moveTo);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      dom.removeEventListener("wheel", wheel);
    };
  }, [dom, drag, view]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    nav.yaw = view.yaw;
    const p = state.player;
    const tx = p.x;
    const ty = CAMERA.targetHeight;
    const tz = p.z;
    // Below minPitch the camera stays put and the view tilts up instead (lookUp).
    const pitch = Math.max(view.pitch, CAMERA.minPitch);
    const lookUp = pitch - view.pitch;
    const flat = Math.cos(pitch) * view.distance;
    const ox = Math.sin(view.yaw) * flat;
    const oy = Math.sin(pitch) * view.distance;
    const oz = Math.cos(view.yaw) * flat;
    // Near the barrier the arm gets shorter; the camera rises by what it lost, so it looks
    // down over the player instead of moving into them.
    const t = fitFlat(tx, tz, ox, oz);
    const cx = tx + ox * t;
    const cz = tz + oz * t;
    const cy = clamp(ty + oy + (1 - t) * flat, CAMERA.minY, CAMERA.maxY);
    // Both ends of the blend are inside the box, so every point between them is too.
    const k = view.ready ? 1 - Math.exp(-10 * dt) : 1;
    view.ready = true;
    camera.position.set(
      camera.position.x + (cx - camera.position.x) * k,
      camera.position.y + (cy - camera.position.y) * k,
      camera.position.z + (cz - camera.position.z) * k,
    );
    camera.lookAt(tx, ty, tz);
    if (lookUp > 0) camera.rotateX(lookUp);
    state.camera.x = camera.position.x;
    state.camera.y = camera.position.y;
    state.camera.z = camera.position.z;
    state.camera.yaw = view.yaw;
    state.camera.pitch = pitch;
    state.camera.lookUp = lookUp;
  });

  return null;
}

export const SPAWN_CAMERA = [SPAWN.x, CAMERA.targetHeight + Math.sin(CAMERA.pitch) * CAMERA.distance, SPAWN.z + Math.cos(CAMERA.pitch) * CAMERA.distance];
