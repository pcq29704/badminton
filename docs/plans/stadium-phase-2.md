# Stadium (Beta) — Phase 2: Ranking Wall and Honours Hall

Status: Ready to build after Phase 1 is done.
Depends on: `docs/plans/stadium-phase-1.md` (scene, player, colliders, `src/features/stadium/`).
Mood reference: a hanging royal banner — deep crimson velvet, cream header band with blue scrollwork, gold embroidered border, a crest near the bottom, a gold rod with finials, gold tassels and a long gold fringe with a V-shaped bottom. Lit softly from one side and shown against a dark background.

## 1. Goal

Make the stadium feel like a royal hall of fame. Show the live club ranking and the club's honours on the stadium walls. Hang a royal banner behind the ranking wall and behind each honour profile.

## 2. Scope

### In scope
- **Ranking Wall** on the scoreboard end wall (it replaces the empty scoreboard frame, or sits under it).
- **Honours Hall**: one row of honour profiles along a long side wall, each with its own royal banner.
- A **royal banner** component built in code: cloth, rod, finials, fringe, tassels and crest.
- Live data from the existing ranking query. No new backend in Phase 2.
- Lighting for the walls: warm gold spotlights.
- Click/tap a ranking row or an honour profile to open that player's `/profile?u=...` page.

### Out of scope
- New database tables or migrations.
- Animated character (Phase 3), sound, trophies in 3D.
- Seasonal or historical honours (all-time only in Phase 2).

## 3. Data

Source: `clubQuery` in `src/features/queries` (used by `src/features/dashboard/useClubGames.js`). It returns `viewer`, `games` and `ranking`.

- Ranking entry fields that exist now: `name`, `username`, `elo`, `tier`, `profile_image_path`.
- Re-use `RANK_NAMES` (`src/lib/rank-names.js`), `RankIcon`, `PlayerAvatar` and `tierKey`, so the 3D wall matches `/ranking`.
- Compute honours on the client from `games` + `ranking` in a pure function `src/features/stadium/honours.js`, with unit tests.

### Honours (6 profiles)

| Honour | Title on banner | Rule | Minimum |
|---|---|---|---|
| Top Elo | **The Crown** | Highest Elo | ≥ 1 game |
| Most wins | **The Conqueror** | Most wins, all time | ≥ 1 win |
| Best win rate | **The Unbroken** | Highest win % | ≥ 10 games |
| Longest win streak | **The Relentless** | Longest run of consecutive wins | ≥ 3 |
| Most games played | **The Stalwart** | Most games played | ≥ 1 game |
| Best current form | **The Rising Star** | Most wins in last 10 games | ≥ 5 games |

- Ties: higher Elo wins the tie, then alphabetical name.
- If no player meets the minimum, show the banner with the title and "Unclaimed". Do not hide it.
- Read the game data shape before you code. If a stat cannot be computed from the existing data, drop that honour and record why in the Dev notes. Do not add backend work.

## 4. Visual design

### Royal banner (`RoyalBanner.jsx`)
| Part | Spec |
|---|---|
| Cloth | Vertical plane, about 2.2 m × 5 m (ranking wall: about 9 m wide). Deep crimson velvet. Subdivided geometry with a gentle hang (slight curve) and an optional slow sway in the vertex shader. |
| Header band | Cream band at the top with blue scrollwork. |
| Border | Gold embroidered border, about 8 cm, all around. |
| Bottom | V-shaped (pointed) bottom edge with a gold fringe. |
| Crest | Shield near the bottom. On honour banners it shows the honour emblem. On the ranking banner it shows the club crest (or the S-rank icon). |
| Rod | Gold rod with round finials, hung from cords. |
| Tassels | 2 large tassels at the rod ends and small tassels at the bottom corners. |
| Texture | Generate in code (CanvasTexture: velvet noise, gold scroll pattern, border) or use CC0 fabric maps from ambientCG / Poly Haven. Do not copy the reference image. |
| Material | `MeshStandardMaterial` / `MeshPhysicalMaterial` with `sheen` for velvet. Gold parts use metalness ~1 and roughness ~0.35. |

### Ranking Wall (`RankingWall.jsx`)
- One large royal banner behind it, with a dark stone or wood panel frame.
- Title: **"Hall of Ranks"** in the app's display font, gold.
- Show the **top 10**: position, avatar, name, rank name, tier icon, Elo. Positions 1–3 get gold, silver and bronze accents and a crown icon for #1.
- If the signed-in player is outside the top 10, add a separate "You" row with their position.
- Render with drei `<Html transform occlude>` and the existing `cb-` classes, or as a 3D text/texture panel. It must stay sharp when you read it from 4 m away.

### Honours Hall (`HonoursHall.jsx`, `HonourProfile.jsx`)
- 6 banners in a row along one long side wall, above the barrier. Their bottoms are about 2.5 m above the floor.
- In front of each banner, a profile plaque: the honour title, avatar in a gold ring, player name, rank name and the stat value (for example "14 wins in a row").
- A small gold spotlight on each banner.

### Lighting and mood
- Keep the court lighting from Phase 1. Add warm, narrow spotlights to the walls so the banners glow against darker surroundings.
- Use the Emerald Crown palette for the UI and add crimson, cream and gold only on the banners.

### Interaction
- When the player walks within about 4 m of the ranking wall or an honour, show a hint: "Tap / press E to view profile".
- Pressing E, or tapping the plaque or row, opens `/profile?u=<username>`. If the player has no username, nothing happens.

## 5. Performance
- Create the banner textures once and share them. Each honour banner varies only its crest and title.
- Fewer than 150 draw calls added. Keep the Phase 1 fps targets (60 desktop, 30+ phone).
- Use `<Html>` only for the 2 boards. Do not create one DOM node per seat or per tassel.

## 6. Implementation steps

1. **Read.** `docs/plans/stadium-phase-1.md` and the Phase 1 code in `src/features/stadium/`, `src/features/queries`, `PlayerRanking.jsx`, `RankLadder.jsx`, `ProfileStats.jsx`, `rank-names.js`, `DESIGN.md` and the `cb-` tokens in `src/app/ui.css`. Next.js 16: read `node_modules/next/dist/docs/` before you change routing or data loading.
2. **Data hook.** Load `clubQuery` on `/stadium` (same pattern as `useClubGames`). Pass `ranking`, `games` and `viewer` into the scene.
3. **Honours logic.** Write `honours.js` as pure functions for the 6 rules, ties and the "Unclaimed" case. Add unit tests in the repo's test setup (`tests/`): normal data, ties, below-minimum, empty club, and a streak that runs to the latest game.
4. **Banner.** Build `RoyalBanner.jsx`: cloth, header, border, V-bottom, fringe, crest slot, rod, finials, cords and tassels. Check it alone first (a temporary debug view in dev).
5. **Ranking Wall.** Build `RankingWall.jsx` with the banner, frame, title, top 10, podium accents and the "You" row.
6. **Honours Hall.** Build `HonourProfile.jsx` and `HonoursHall.jsx` (6 banners + plaques + spotlights).
7. **Placement.** Put the wall on the scoreboard end and the honours along one long side. They must not block the walkable floor, and the Phase 1 colliders stay unchanged.
8. **Interaction.** Add the proximity hint, the E key, tap/click and navigation to the profile.
9. **Lighting pass.** Add the warm spotlights, adjust exposure, and check against the reference mood.
10. **Performance pass.** Shared textures and materials, draw-call count, fps.
11. **Verify** with the checks in section 7. Fix every failure.

## 7. Verification

Use the dev server in the browser preview. Show screenshots and log output as proof.

1. `npm run build` passes. Lint passes if the repo has it. The honours unit tests pass (show the output).
2. **Data match:** the ranking wall's top 10 (order, names, Elo, rank names) is the same as `/ranking`. Compare both pages, using `javascript_tool` or `get_page_text` on `/ranking`.
3. **"You" row:** with a player outside the top 10, the row shows with the correct position. With a player in the top 10, their row is highlighted and there is no extra row.
4. **Honours:** for each of the 6 honours, the shown player and value match a manual calculation from the same data (log the `honours.js` output in dev and compare it).
5. **Unclaimed:** with test data below a minimum (unit test), the banner shows "Unclaimed".
6. **Banner look:** screenshots of the ranking banner and one honour banner from 3 m away. All parts must be visible: crimson cloth, cream header with blue scroll, gold border, V-bottom, fringe, crest, rod, finials and tassels.
7. **Readability:** text on both boards can be read in a screenshot from about 4 m away, at desktop size and at 375 px mobile width.
8. **Interaction:** walk to an honour. The hint shows. Press E: the browser goes to the correct `/profile?u=...`. Do the same with a tap at mobile width.
9. **Collision unchanged:** the Phase 1 barrier test (all 4 sides) and the walk-through-net test still pass.
10. **Performance:** desktop fps ≈ 60 (drei Stats). Report the draw calls (`renderer.info.render.calls`) before and after Phase 2. The increase is less than 150.
11. **Console:** no errors or warnings from the page.
12. **Empty club:** with no ranking data, the wall shows "No players yet" and the honours show "Unclaimed". Nothing crashes.
13. Reset the viewport to desktop at the end.

## 8. Definition of done

- Every check in section 7 passes, with evidence shown.
- The ranking wall data is the same as `/ranking`. No new backend, table or migration.
- The 6 honours (or fewer, with dropped ones explained) are computed in tested pure functions.
- Every banner has all the parts listed in section 4 and reads as royal: crimson, cream, blue scroll and gold.
- The Phase 1 movement, collision and fps targets still pass.
- New code is in `src/features/stadium/`. Only the minimum shared files changed.
- Nothing committed. A summary lists the changed files and the verification results.

## 9. Open questions (defaults used if not answered)

1. Honour list and titles — default: the 6 in section 3.
2. Top 10 on the wall — or show all players with scrolling?
3. Club crest artwork — default: the S-rank icon on the shield.
4. Banner sway animation — default: on, slow and subtle; turned off when `prefers-reduced-motion` is set.

---

## Implementation prompt (copy into a new chat)

Build **Stadium Phase 2** in this repo. Phase 1 (`docs/plans/stadium-phase-1.md`) is already built. The full spec is `docs/plans/stadium-phase-2.md`. Read it all first. Follow its steps (section 6) in order, run every verification check (section 7) with screenshots or log output as proof, and stop only when the Definition of done (section 8) is met. Use the defaults in section 9. Next.js 16 differs from your training data: read `node_modules/next/dist/docs/` before you change routing or data loading. Re-use the existing ranking query and components. Add no backend changes. Do not copy the reference banner image; build the banner in code. Do not commit. At the end, list the changed files and the result of each check.

---

## Dev notes (implementation, 2026-11-18)

- **Honours:** all 6 are kept. Every stat can be computed from `clubQuery` (`games` + `ranking`). The logic is in `src/features/stadium/honours.mjs` (`.mjs`, like `days.mjs` and `dashboard.mjs`, so `node --test` loads it without a module-type warning), with tests in `tests/stadium-honours.test.mjs`.
  - Every finished game counts, ranked or not, the same as the profile stats. Only active players (in `ranking`) can hold an honour.
  - "Games played" is counted from `games`, not `games_total`. It can differ from `games_total` because seeded counts have no game rows. `loadGames` returns at most 1000 games, so with more history the oldest games drop out.
- **Info on the cloth (changed on review, 2026-11-18):** the ranking and the honours are drawn on the banner cloth itself. There are no boards, plaques or drei `<Html>` elements.
  - Each info layer is a CanvasTexture on a patch mesh that copies the cloth shape and sway (`patchGeometry`, `addRipple` in `bannerKit.js`), 6 mm in front of the cloth.
  - Ranking banner (9.2 m × 6 m, top at 7.4 m, `RANKING_WALL`): the "Hall of Ranks" cartouche, then the top 10 in 2 columns of 5 (position, avatar, name, rank name, tier badge, Elo), podium colours and a crown on #1, then the "You" row, then the club crest in the V. Drawing is in `RankingWall.jsx`.
  - Honour banners (2.2 m × 5 m, `HONOURS_HALL`): under the title, the honour label, avatar in a gold ring, name, rank name and stat, then the honour crest in the V. All 6 share one 3 × 2 atlas texture and material. Drawing is in `HonourProfile.js`. An unclaimed honour shows "?", "Unclaimed" and the rule.
  - The banners hang over the end barrier and the +X barrier, off the walkable floor. The colliders are unchanged. The empty scoreboard frame is removed (replaced).
- **Camera (Phase 1 file changed):**
  - Dragging past the lowest orbit angle now tilts the view up (up to 0.6 rad) without moving the camera, so the banners can be read from near. The camera position limits (seats, dome) are unchanged.
  - Two-finger pinch zooms on touch, so phone players can get close enough to read the banners (the wheel already did this on desktop).
  - The drag listeners are on the canvas wrapper (`events.connected`), the element R3F reads pointer events from.
- **Clicks and taps:** raycast on the info patch. The hit `uv` becomes canvas pixels and is checked against the row boxes from the draw function. A ranking row opens that player; an honour banner opens its holder. A drag (more than `TAP_SLOP`) does not count as a tap.
- **E key at the ranking wall:** opens the row under the mouse pointer. If no row is under the pointer, it opens #1. The hint names the player.
- **Screen readers:** the page has a hidden text copy of the ranking and honours (`WallsText` in `StadiumPage.jsx`), and the hint is `aria-live`.
- **Banners:** all textures are drawn on canvas in code (velvet noise, damask lattice, cream band with blue scroll, gold border along the V, fringe strands, tassel stripes, crest emblems, titles in the display font).
  - One cloth texture per size (honour, ranking), one crest atlas and one title atlas are shared by all banners.
  - Gold uses a generated `RoomEnvironment` env map on the banner materials only (the Phase 1 materials are unchanged).
  - Sway is a slow vertex-shader ripple, shared by the cloth and the info layers. It is off when `prefers-reduced-motion` is set.
- **Dev-only switches** (no effect in production): `?debug=empty` (empty club), `?viewer=<username>` (view the walls as that player). `window.__stadium` also has `honours`, `board`, `interact`, `calls`, `walkTo(x, z)` and `scene`.
- **Draw calls:** with culling off, the two walls add 69 (38 without them, 107 with them), under the 150 limit. 165 fps on the dev machine.
