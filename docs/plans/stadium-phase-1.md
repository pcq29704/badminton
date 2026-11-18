# Stadium (Beta) — Phase 1

Status: Ready to build — decisions in section 8.
Reference: indoor tournament arena photo (seats on all sides, coloured floor, green courts, central scoreboard).

## 1. Goal

Prove that a walkable 3D stadium works in the app. It must load fast, run smoothly, and work for every signed-in user.

## 2. Scope

### In scope
- New route `/stadium` with a Beta tag, signed-in users only.
- Dome stadium built in code (no downloaded models).
- **2 badminton courts** in the centre of the hall floor.
- Seating bowl on **all 4 sides**.
- One controllable player (simple capsule figure).
- Third-person follow camera.
- Collision: the player walks on the hall floor only.

### Out of scope (later phases)
- Ranking wall and honours board (Phase 2).
- Animated character model, mobile joystick, sound (Phase 3).
- Courts 3 and 4 (layout keeps space for them).
- Multiplayer, other players visible, live match data.

## 3. Scene layout

| Element | Spec |
|---|---|
| Court | Official size 13.40 m × 6.10 m. White lines, 40 mm wide. Doubles + singles lines. Green court surface. |
| Net | 1.55 m at posts, 1.524 m at centre. Posts on the doubles sidelines. |
| Courts | 2 courts side by side, long sides parallel. ~4 m gap between courts. |
| Hall floor | Coloured run-off floor (photo: magenta). ~40 m × 30 m. |
| Floor boards | Low advertising boards around each court (simple panels, no brand names). |
| Seating | Raked tiers on all 4 sides. Stairs between seat blocks. Seats are simple coloured blocks. |
| Barrier | Wall ~1.0 m high between floor and first seat row. |
| Dome | Curved roof over the whole hall. Roof light rings and spotlight fixtures. |
| Scoreboard | Empty screen frame on one end wall (Phase 2 fills it). |
| Lighting | Bright, even light on the courts. Darker stands, like the photo. |

## 4. Player and controls

| Item | Spec |
|---|---|
| Body | Capsule figure, ~1.75 m, in the app accent colour. |
| Desktop | WASD or arrow keys to move. Shift to run. Mouse drag orbits the third-person camera. |
| Mobile | Phase 1: tap-to-walk on the floor (simple). Joystick in Phase 3. |
| Speed | Walk ~3 m/s, run ~6 m/s. |
| Spawn | At floor level, between the 2 courts, facing the scoreboard. |

## 5. Walkable area rules

- The player can walk on the hall floor and **on the courts**.
- The player **cannot** cross the barrier wall into the seats.
- The player cannot walk through net posts or advertising boards. The net itself is pass-through.
- The camera must not clip through the seats or the dome.

## 6. Tech

| Part | Choice |
|---|---|
| Rendering | `three` + `@react-three/fiber` |
| Helpers | `@react-three/drei` (camera, keyboard controls, `Html`, `Stats` in dev) |
| Collision | `@react-three/rapier` (static colliders for barrier, posts, boards) |
| Loading | `next/dynamic` with `ssr: false` — 3D code loads only on `/stadium` |
| Access | Signed-in users only; no feature flag |
| Files | `src/features/stadium/` (Scene, Court, Stands, Dome, Player, Controls) |

Read `node_modules/next/dist/docs/` before writing the route (Next.js 16).

## 7. Outcome (what you get at the end of Phase 1)

1. A signed-in user clicks the "Stadium · Beta" nav item and opens `/stadium`.
2. A loading screen shows, then the 3D hall opens.
3. The user sees a dome arena: 2 green courts with correct lines and nets, a coloured floor, seats on all sides, a scoreboard frame, stadium lighting.
4. The user walks the player around the floor and across the courts with the keyboard (or tap on mobile).
5. The player stops at the barrier. The seats are not reachable.
6. A "Back" button returns to the app.

### Acceptance checks
- 60 fps on a mid-range laptop; 30+ fps on a recent phone.
- `/stadium` JS bundle does not change the size of other pages.
- Court lines match official measurements.
- Player cannot reach any seat in a 2-minute walk test along all barriers.
- Page works in light and dark app theme (UI overlay only).

## 8. Decisions (2026-11-18)

These override any conflicting text above.

| # | Topic | Decision |
|---|---|---|
| 1 | Beta gate | **No flag.** Everyone can open the page. The page shows a **"Beta" tag** (in nav item and page header). |
| 2 | Entry point | **Nav item** "Stadium" with a Beta tag, in the main app navigation. |
| 3 | Login | **Signed-in users only.** Signed-out users go to sign-in (same behaviour as other protected pages). |
| 4 | Colours | Not answered — default: **Emerald Crown** palette (dark floor, emerald courts, gold accents). Change if wanted. |
| 5 | Seats | **15 rows per side**, all 4 sides. Visual only. |
| 6 | Net | **Pass-through.** Player can walk through the net. Net posts still block. |
| 7 | Camera | **Third-person only.** |
| 8 | Mobile | **Tap-to-walk** on the floor. |
| 9 | Crowd | **Empty seats.** |
