"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { HONOUR_Z, HONOURS_HALL, INTERACT_DISTANCE, RANKING_WALL } from "./constants";

// What the player is next to, if anything: the ranking banner or the nearest honour banner, within
// INTERACT_DISTANCE on the floor. At the ranking wall the target is the row under the pointer, else #1.
function findTarget(x, z, { rows, honours, hovered }) {
  const half = RANKING_WALL.banner.width / 2;
  let best = null;
  let bestDistance = INTERACT_DISTANCE;
  const toWall = Math.hypot(Math.max(0, Math.abs(x) - half), z - RANKING_WALL.z);
  if (toWall <= bestDistance) {
    best = "ranking";
    bestDistance = toWall;
  }
  HONOUR_Z.forEach((hz, i) => {
    const d = Math.hypot(x - HONOURS_HALL.x, z - hz);
    if (d <= bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  if (best === "ranking") {
    const row = hovered ?? rows[0] ?? null;
    if (!row) return { key: "ranking:empty", title: "Hall of Ranks", name: "No players yet", username: "" };
    return { key: `ranking:${row.position}:${row.username}`, title: `Hall of Ranks · #${row.position}`, name: row.name, username: row.username || "" };
  }
  if (best === null) return null;
  const honour = honours[best];
  const holder = honour?.holder;
  return { key: `honour:${honour.key}:${holder?.username ?? ""}:${holder?.name ?? ""}`, title: honour.title, name: holder?.name ?? "Unclaimed", username: holder?.username ?? "" };
}

const typing = (el) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

// Shows the "Tap / press E to view profile" hint near a wall, and opens the profile on E.
// onTarget runs only when the target changes, so the page re-renders rarely.
export default function Interaction({ state, rows, honours, hoverRef, onTarget, onOpen }) {
  const current = useRef(null);
  const data = useRef({ rows, honours });
  data.current = { rows, honours };

  useFrame(() => {
    const target = findTarget(state.player.x, state.player.z, { ...data.current, hovered: hoverRef.current });
    if ((target?.key ?? "") === (current.current?.key ?? "")) return;
    current.current = target;
    state.interact = target; // dev checks read this (window.__stadium)
    onTarget?.(target);
  });

  useEffect(() => {
    const down = (event) => {
      if (event.code !== "KeyE" || event.repeat || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      const username = current.current?.username;
      if (username) onOpen(username);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [onOpen]);

  useEffect(() => () => onTarget?.(null), [onTarget]);
  return null;
}
