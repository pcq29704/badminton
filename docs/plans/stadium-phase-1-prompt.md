# Implementation prompt — Stadium Phase 1

Copy everything below the line into a new chat.

---

Build **Stadium Phase 1** in this repo. The spec is `docs/plans/stadium-phase-1.md`. Read all of it first. **Section 8 (Decisions) overrides the rest of the spec.**

## Context
- Next.js 16 + React 19. This Next.js differs from your training data. Read the relevant guides in `node_modules/next/dist/docs/` before you write the route (app router pages, client components, `next/dynamic`).
- The design system is the `cb-` classes in `src/app/ui.css`, plus `DESIGN.md`. Use them for all 2D UI (header, Beta tag, loading screen, Back button, hints).
- Look at how existing protected pages check sign-in and how the main nav is built. Copy those patterns. Do not invent a new auth check.
- Do not touch the uncommitted court-balancer work unless the task needs it.

## Steps
1. **Explore.** Find the app's nav component, one protected page (to copy its sign-in redirect), and the colour tokens in `ui.css`. Write a short summary before you code.
2. **Dependencies.** Install `three`, `@react-three/fiber`, `@react-three/drei` and `@react-three/rapier`. Use versions that support React 19. Check `npm ls` for peer warnings.
3. **Route.** Create `src/app/stadium/page` (follow the repo's file extension and conventions). The page is signed-in only and uses the same redirect as other protected pages. The page shell has a header "Stadium" + a **Beta** tag, a Back link, and the 3D canvas loaded with `next/dynamic({ ssr: false })` and a loading state.
4. **Nav item.** Add "Stadium" with a small **Beta** tag to the main navigation, on desktop and mobile. Show it only where signed-in nav items show.
5. **Scene modules** in `src/features/stadium/`:
   - `constants.js`: all dimensions in metres (court 13.40 × 6.10, line 0.04, net 1.55 at posts / 1.524 centre, floor ~40 × 30, 15 seat rows, barrier 1.0 m, court gap ~4 m). Leave space in the layout for courts 3 and 4.
   - `Court.jsx`: surface, all doubles and singles lines, posts, net mesh.
   - `Hall.jsx`: floor, low boards around each court (no brand names), barrier wall, empty seating bowl with 15 rows on all 4 sides and stairs between blocks, dome roof, light rings, empty scoreboard frame on one end wall.
   - `Player.jsx`: capsule figure ~1.75 m with a Rapier kinematic or dynamic capsule body.
   - `Controls.jsx`: WASD/arrows, Shift to run (walk 3 m/s, run 6 m/s). Tap/click on the floor to walk to that point.
   - `CameraRig.jsx`: third-person follow camera with mouse/touch-drag orbit, clamped so it never goes below the floor or through seats or the dome. No first-person mode.
   - `StadiumScene.jsx`: puts together the Canvas, lights, physics and the modules above.
   Use instancing (`InstancedMesh` / drei `Instances`) for seats.
6. **Collision rules.** Static colliders on the barrier wall (whole perimeter), net posts, boards and outer walls. **No collider on the net** (pass-through). Spawn between the 2 courts, facing the scoreboard.
7. **Colours.** Use the Emerald Crown palette: dark floor, emerald courts, white lines, gold accents. Read the values from the `ui.css` tokens where you can.
8. **Performance.** Cap DPR at about 1.5, use soft shadows only on the courts or none, and avoid per-frame allocations. Add drei `<Stats />` in dev only.
9. **Verify** (see below). Fix every failure. Then report the results.

## Verification (do all of it, and show the evidence)
Use the browser preview (`.claude/launch.json` dev server) and the in-app browser tools.
1. `npm run build` passes with no new errors or warnings. `npm run lint` passes if the repo has it.
2. **Signed out:** `/stadium` redirects to sign-in. The nav item is not shown.
3. **Signed in:** the nav item "Stadium · Beta" shows on desktop and at mobile width (375 px). Clicking it opens the page.
4. The page header shows the Beta tag. The Back link returns to the previous app page.
5. The scene shows 2 courts, nets, boards, the barrier, 15 rows of empty seats on all 4 sides, the dome and the scoreboard frame. Take screenshots from the spawn point and from 2 other angles.
6. **Movement:** press W/A/S/D and the arrows, and check that the player position changes (read it with `javascript_tool` from a debug value on `window` that exists only in dev). Shift increases the speed.
7. **Walk-through net:** walk across the net line. The player passes.
8. **Barrier:** hold a direction into the barrier on each of the 4 sides for 3 s. The player's position stays inside the floor bounds.
9. **Tap-to-walk:** with the mobile viewport, click a floor point. The player moves to it. Clicking seats does not move the player into the seats.
10. **Camera:** drag to orbit. The camera never goes below the floor or through the dome.
11. **Bundle:** compare the build output. Other routes' first-load JS must not grow because of three.js.
12. **FPS:** read drei Stats. Expect about 60 fps on desktop. Note the value.
13. The console has no errors or warnings from the page.
14. Reset the viewport to desktop at the end.

## Done when
- Every verification item passes, with screenshots or log output shown.
- The spec's acceptance checks (section 7) are met.
- Change only the new files, the nav component and `package.json`/lockfile.
- Do not commit. Give me a summary of the files changed and the verification results.
