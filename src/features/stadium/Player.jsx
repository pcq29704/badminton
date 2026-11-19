"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier";
import { PLAYER, PLAYER_CENTER_Y, PLAYER_HALF_HEIGHT, SPAWN, WALK_BOUNDS } from "./constants";

const clamp = (v, max) => Math.max(-max, Math.min(max, v));
const damp = (from, to, rate, dt) => to + (from - to) * Math.exp(-rate * dt);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Dev only: live values for checks in the browser (window.__stadium).
const debug = process.env.NODE_ENV === "development";

// A capsule figure (~1.75 m) on a kinematic Rapier body. Rapier's character controller moves it,
// so it slides along the barrier, boards and net posts and never passes through them.
// The net has no collider, so the player walks through it.
export default function Player({ nav, palette, state }) {
  const body = useRef(null);
  const collider = useRef(null);
  const figure = useRef(null);
  const { world } = useRapier();
  const [, getKeys] = useKeyboardControls();
  const controller = useRef(null);
  // Plain numbers, reused every frame (no allocations in the loop).
  const s = useRef({ x: SPAWN.x, z: SPAWN.z, vx: 0, vz: 0, facing: SPAWN.facing, stuck: 0 }).current;
  const move = useRef({ x: 0, y: 0, z: 0 }).current;
  const next = useRef({ x: 0, y: PLAYER_CENTER_Y, z: 0 }).current;

  useEffect(() => {
    const cc = world.createCharacterController(0.02);
    cc.setSlideEnabled(true);
    controller.current = cc;
    return () => {
      world.removeCharacterController(cc);
      controller.current = null;
    };
  }, [world]);

  useEffect(() => {
    if (!debug) return;
    window.__stadium = state;
    return () => { delete window.__stadium; };
  }, [state]);

  useFrame((_, rawDt) => {
    const cc = controller.current;
    if (!cc || !collider.current || !body.current) return;
    const dt = Math.min(rawDt, 0.1);
    const keys = getKeys();

    // Input relative to the camera: forward is away from the camera.
    const ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    const iz = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
    let dirX = 0;
    let dirZ = 0;
    let speed = 0;
    if (ix || iz) {
      nav.hasTarget = false;
      const sin = Math.sin(nav.yaw);
      const cos = Math.cos(nav.yaw);
      dirX = cos * ix - sin * iz;
      dirZ = -sin * ix - cos * iz;
      const len = Math.hypot(dirX, dirZ);
      dirX /= len;
      dirZ /= len;
      speed = keys.run ? PLAYER.run : PLAYER.walk;
    } else if (nav.hasTarget) {
      const dx = nav.targetX - s.x;
      const dz = nav.targetZ - s.z;
      const dist = Math.hypot(dx, dz);
      if (dist < PLAYER.arrive) {
        nav.hasTarget = false;
      } else {
        dirX = dx / dist;
        dirZ = dz / dist;
        speed = PLAYER.walk;
      }
    }

    s.vx = damp(s.vx, dirX * speed, PLAYER.accel, dt);
    s.vz = damp(s.vz, dirZ * speed, PLAYER.accel, dt);
    move.x = s.vx * dt;
    move.y = 0;
    move.z = s.vz * dt;

    cc.computeColliderMovement(collider.current, move);
    const done = cc.computedMovement();
    const wanted = Math.hypot(move.x, move.z);
    const moved = Math.hypot(done.x, done.z);
    s.x = clamp(s.x + done.x, WALK_BOUNDS.x);
    s.z = clamp(s.z + done.z, WALK_BOUNDS.z);
    next.x = s.x;
    next.z = s.z;
    body.current.setNextKinematicTranslation(next);

    // Tap-to-walk gives up when something blocks the way for a moment.
    if (nav.hasTarget && wanted > 1e-4 && moved < wanted * 0.25) s.stuck += dt;
    else s.stuck = 0;
    if (s.stuck > 0.6) { nav.hasTarget = false; s.stuck = 0; }

    // Face the way the player moves.
    if (moved > 1e-4) {
      const want = Math.atan2(done.x, done.z);
      s.facing += wrapAngle(want - s.facing) * (1 - Math.exp(-12 * dt));
    }
    const g = figure.current;
    g.position.set(s.x, 0, s.z);
    g.rotation.y = s.facing;

    state.player.x = s.x;
    state.player.y = 0;
    state.player.z = s.z;
    state.speed = moved / dt;
    state.running = Boolean(keys.run) && (ix !== 0 || iz !== 0);
    state.walkingTo = nav.hasTarget;
    state.target.x = nav.targetX;
    state.target.z = nav.targetZ;
  });

  const cylinder = PLAYER_HALF_HEIGHT * 2;
  return <>
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[SPAWN.x, PLAYER_CENTER_Y, SPAWN.z]} enabledRotations={[false, false, false]}>
      <CapsuleCollider ref={collider} args={[PLAYER_HALF_HEIGHT, PLAYER.radius]} />
    </RigidBody>
    <group ref={figure} position={[SPAWN.x, 0, SPAWN.z]} rotation-y={SPAWN.facing}>
      <mesh position-y={PLAYER.height / 2} raycast={() => null}>
        <capsuleGeometry args={[PLAYER.radius, cylinder, 6, 16]} />
        <meshStandardMaterial color={palette.player} metalness={0.35} roughness={0.4} />
      </mesh>
      {/* visor: shows which way the player faces */}
      <mesh position={[0, PLAYER.height - 0.3, PLAYER.radius - 0.04]} raycast={() => null}>
        <boxGeometry args={[0.34, 0.1, 0.14]} />
        <meshStandardMaterial color={palette.playerVisor} roughness={0.3} />
      </mesh>
      {/* soft contact shadow */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={() => null}>
        <circleGeometry args={[0.42, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  </>;
}
