"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Object3D } from "three";
import { createBannerKit } from "./bannerKit";
import CameraRig, { SPAWN_CAMERA } from "./CameraRig";
import { StadiumKeys, TapMarker, createNav, useFloorTap } from "./Controls";
import Court from "./Court";
import Hall from "./Hall";
import { computeHonours, rankingBoard } from "./honours.mjs";
import HonoursHall from "./HonoursHall";
import Interaction from "./Interaction";
import Player from "./Player";
import RankingWall from "./RankingWall";
import { CAMERA, COURT_X, FLOOR_HALF_X, FLOOR_HALF_Z, RANKING_WALL, SPAWN, WALK_BOUNDS } from "./constants";
import { readPalette } from "./palette";

const dev = process.env.NODE_ENV === "development";

// Bright, even light on the courts; the stands stay darker. The walls add their own warm spotlights.
function Lights({ palette }) {
  const targets = useMemo(() => COURT_X.map((x) => {
    const target = new Object3D();
    target.position.set(x, 0, 0);
    return target;
  }), []);
  return <>
    <hemisphereLight args={[palette.sky, palette.background, 0.55]} />
    <ambientLight intensity={0.12} />
    <directionalLight position={[6, 20, 8]} intensity={0.55} />
    {COURT_X.map((x, i) => <group key={x}>
      <primitive object={targets[i]} />
      <spotLight position={[x, 14, 0]} target={targets[i]} angle={0.62} penumbra={0.6} intensity={2.4} decay={0} distance={0} />
    </group>)}
  </>;
}

// Frames per second, measured over half a second, and (dev) the draw calls of the last frame.
function FpsMeter({ state }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!dev) return;
    state.scene = scene; // dev checks: draw-call counts with culling off, walls on and off
    return () => { delete state.scene; };
  }, [scene, state]);
  const acc = useRef({ frames: 0, time: 0 }).current;
  useFrame((_, dt) => {
    state.calls = gl.info.render.calls; // useFrame runs before the render, so this is the previous frame
    acc.frames += 1;
    acc.time += dt;
    if (acc.time >= 0.5) {
      state.fps = Math.round(acc.frames / acc.time);
      acc.frames = 0;
      acc.time = 0;
    }
  });
  return null;
}

// Tells the page the first frame with the whole hall (and Rapier) is on screen.
function Ready({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    onReady?.();
  });
  return null;
}

// The banner textures, materials and geometries, made once and shared by every banner.
function useBannerKit() {
  const gl = useThree((s) => s.gl);
  const kit = useMemo(() => createBannerKit(gl), [gl]);
  useEffect(() => () => kit.dispose(), [kit]);
  return kit;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Walls({ palette, nav, state, club, onTarget, onOpenProfile }) {
  const kit = useBannerKit();
  const hoverRef = useRef(null);
  const sway = useMemo(() => !reducedMotion(), []);
  const board = useMemo(() => rankingBoard(club.ranking, club.viewer, RANKING_WALL.rows), [club]);
  const honours = useMemo(() => computeHonours(club.games, club.ranking), [club]);

  useEffect(() => {
    if (!dev) return;
    state.board = board;
    state.honours = honours;
    // Dev check: the honours as the wall shows them (compare with a manual count from the same data).
    console.info("[stadium] honours", honours.map((h) => ({ honour: h.title, holder: h.holder?.name ?? null, username: h.holder?.username ?? null, value: h.value, stat: h.stat })));
  }, [board, honours, state]);

  useEffect(() => {
    if (!dev) return;
    // Dev check: walk the player to a floor point (the same as a tap), e.g. __stadium.walkTo(17, -11).
    state.walkTo = (x, z) => {
      nav.targetX = Math.max(-WALK_BOUNDS.x, Math.min(WALK_BOUNDS.x, x));
      nav.targetZ = Math.max(-WALK_BOUNDS.z, Math.min(WALK_BOUNDS.z, z));
      nav.hasTarget = true;
    };
  }, [nav, state]);

  return <>
    <RankingWall kit={kit} palette={palette} rows={board.rows} you={board.you} onHover={(row) => { hoverRef.current = row; }} onOpen={onOpenProfile} />
    <HonoursHall kit={kit} palette={palette} honours={honours} onOpen={onOpenProfile} sway={sway} />
    <Interaction state={state} rows={board.rows} honours={honours} hoverRef={hoverRef} onTarget={onTarget} onOpen={onOpenProfile} />
  </>;
}

function World({ palette, nav, state, club, onTarget, onOpenProfile, onReady }) {
  const onFloorTap = useFloorTap(nav);
  return <Physics timeStep="vary" gravity={[0, 0, 0]}>
    <Hall palette={palette} onFloorTap={onFloorTap}>
      {COURT_X.map((x) => <Court key={x} x={x} palette={palette} />)}
    </Hall>
    <Walls palette={palette} nav={nav} state={state} club={club} onTarget={onTarget} onOpenProfile={onOpenProfile} />
    <Player nav={nav} palette={palette} state={state} />
    <CameraRig nav={nav} state={state} />
    <TapMarker nav={nav} palette={palette} />
    <FpsMeter state={state} />
    <Ready onReady={onReady} />
  </Physics>;
}

// Dev only: ?debug=empty shows an empty club; ?viewer=<username> views the walls as that player.
function useDebug() {
  return useMemo(() => {
    if (!dev || typeof window === "undefined") return {};
    const params = new URLSearchParams(window.location.search);
    return { view: params.get("debug"), viewer: params.get("viewer") };
  }, []);
}

export default function StadiumScene({ ranking, games, viewer, onTarget, onOpenProfile, onReady, fallback }) {
  const palette = useMemo(readPalette, []);
  const nav = useMemo(createNav, []);
  const debug = useDebug();
  const state = useMemo(() => ({
    player: { x: SPAWN.x, y: 0, z: SPAWN.z },
    camera: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    speed: 0,
    running: false,
    walkingTo: false,
    target: { x: 0, z: 0 }, // last tap-to-walk point
    fps: 0,
    calls: 0,
    interact: null, // the wall target the hint shows
    bounds: { x: FLOOR_HALF_X, z: FLOOR_HALF_Z },
  }), []);
  const club = useMemo(() => {
    if (debug.view === "empty") return { ranking: [], games: [], viewer };
    if (debug.viewer) return { ranking, games, viewer: { ...viewer, username: debug.viewer } };
    return { ranking, games, viewer };
  }, [ranking, games, viewer, debug]);

  return <StadiumKeys>
    <Canvas
      className="cb-stadium-canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      camera={{ fov: CAMERA.fov, near: CAMERA.near, far: 160, position: SPAWN_CAMERA }}
      fallback={fallback}
    >
      <color attach="background" args={[palette.background]} />
      <fog attach="fog" args={[palette.background, 45, 110]} />
      <Lights palette={palette} />
      <Suspense fallback={null}>
        <World palette={palette} nav={nav} state={state} club={club} onTarget={onTarget} onOpenProfile={onOpenProfile} onReady={onReady} />
      </Suspense>
      {dev && <Stats className="cb-stadium-stats" />}
    </Canvas>
  </StadiumKeys>;
}
