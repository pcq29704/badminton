# Emerald Crown Redesign Plan

> **For agentic workers:** Work the tasks in order. Tick each checkbox when it is done and checked. Do not start a phase before the one above it is reviewed by the user.

**Goal:** Move Court Balancer to the "Emerald Crown Ranked" design in `DESIGN.md`: a ranked-game look (filigree cards, tier metals, Cormorant SC + Be Vietnam Pro), one consistent component set, and better UX, one screen at a time.

**Architecture:** Build the new system next to the old one. New tokens and classes live in `src/app/ui.css` with a `cb-` prefix (`--cb-` for tokens), and new React components live in `src/components/ui/`. Each screen moves to the new system in its own phase. When a screen moves, delete the `ds-` rules only it used. When no screen uses the old system, delete `design.css`, `globals.css` and Marcellus SC.

**Tech stack:** Next.js 16 App Router, React 19, plain CSS, `next/font/google`, Node's built-in test runner (`node --test tests/`).

**Sources of truth:**
- Visual rules: `DESIGN.md`.
- Approved references: v1 profile prototype https://claude.ai/artifact/3ZcNJNkqbV5UgRu4f4UJCT and card option B https://claude.ai/artifact/Qo2CDrqv5Y1YXHuHw5AVoK.
- Product rules: `PRODUCT.md`.

**Status:** Phase 0 and 1 done. Phase 2 built; browser checks (2.9) still open (2026-11-05).

## Global constraints

- Rank names come only from `src/lib/rank-names.js` (`RANK_NAMES`). Never type a rank name in a component.
- UI copy is English. Keep existing copy unless the plan says to change it.
- Only these radius values: `0`, `2px` (inputs), `50%` / `9999px` (avatars).
- No drop shadow on cards or buttons, no gradient text, no emoji icons, no ambient motion.
- One reveal animation per show screen, off for `prefers-reduced-motion`.
- Media query breakpoints only at 960, 720, 480, 360 (max-width), the same as `design.css`.
- Touch targets at least 44px on `(pointer: coarse)`.
- All numbers use the body font with `tabular-nums`.
- Do not change data loading, queries, mutations or the API. This is a UI change.
- Use the development Supabase project and the publishable key only.
- Baseline before this work: `node --test tests/` has 50 tests, 47 pass, 3 fail (player API logging, history query fields, password not sent). These 3 failures exist before this plan and are not caused by it. Do not count them as regressions, and do not hide them.

## Phase 0: Decide and document

- [x] Choose the direction (v1 prototype) and the card style (option B, filigree frame).
- [x] Rewrite `DESIGN.md` to the new system, with the filigree card.
- [x] Write this plan.
- [x] Save the decision to project memory.

## Phase 1: Foundation

### 1.1 Fonts
- [x] In `src/app/layout.tsx`, load `Cormorant_SC` (500, 600, 700; subsets latin, latin-ext, vietnamese) as `--font-cb-display`, and `Be_Vietnam_Pro` (400, 500, 600, 700; same subsets) as `--font-cb-body`.
- [x] Keep `Marcellus_SC` (`--font-display`) for now. Old screens still use it. Remove it in Phase 7.

### 1.2 Tokens (`src/app/ui.css`)
- [x] Create `src/app/ui.css` and import it in `layout.tsx` after `design.css`.
- [x] Put every `DESIGN.md` colour on `:root` as `--cb-*` (ground, card, card-top, raised, input-well, ink, muted, faint, gold, gold-hi, gold-deep, on-gold, win, on-win, loss, loss-fill, line, line-soft).
- [x] Tier tokens: `[data-tier="S|A|B|C|D"]` sets `--cb-t-hi`, `--cb-t-main`, `--cb-t-deep`, `--cb-t-gem`. Default (no tier) uses the gold values.
- [x] Font tokens: `--cb-display`, `--cb-body`. Motion token: `--cb-ease`.
- [x] Browser parts inside `.cb-page`: gold `::selection`, gold caret, gold `:focus-visible` ring, thin themed scrollbars.

### 1.3 Shared CSS components (`src/app/ui.css`)
- [x] `.cb-page`: content container (1040px max, 24px / 16px padding, 24px / 18px gap), ground background, body font, tabular numbers.
- [x] `.cb-card` filigree frame: double line, four `.cb-corner` brackets with diamonds, face gradient. `.cb-card-head` (centred title, note, diamond rule), `.cb-card-foot`.
- [x] `.cb-btn` primary and `.cb-btn.quiet`: pointed ends, hover, active, disabled, focus.
- [x] `.cb-tabs` / `.cb-tab`: underline and tier gem on the active tab, sideways scroll on phones.
- [x] `.cb-chip` filter chip with `aria-pressed`.
- [x] `.cb-field`, `.cb-label`, `.cb-input` (focus, read-only), `.cb-hint`.
- [x] `.cb-notice` (status) and `.cb-notice.error`.
- [x] `.cb-stats` stat strip.
- [x] `.cb-ledger` list rows (avatar, name, win bar, record).
- [x] `.cb-empty` empty and loading state.
- [x] `.cb-sr` screen-reader-only text.
- [x] Touch rules: 44px targets on `(pointer: coarse)`, no hover lift on `(hover: none)`.
- [x] Reduced motion: no animations or transitions.

### 1.4 Shared React components (`src/components/ui/`)
- [x] `Card.jsx`: `title`, `note`, `footer`, `as`, `className`, `children`. Renders the four corners.
- [x] `Button.jsx`: `variant` (`primary` | `quiet`), renders `<a>` when `href` is given, else `<button type="button">` by default.
- [x] `Tabs.jsx`: `tabs` (`[{ id, label }]`), `active`, `onChange`, `label`. Real `role="tablist"` / `role="tab"`, `aria-selected`, `aria-controls`, roving `tabIndex`, Left/Right/Home/End keys.
- [x] `StatStrip.jsx`: `items` (`[{ label, value, unit?, note? }]`).
- [x] `Notice.jsx`: `tone` (`status` | `error`), sets `role="status"` or `role="alert"`.
- [x] `Field.jsx`: `label`, `hint`, `htmlFor`, `children`.
- [x] `index.js` exports all of them.

### 1.5 Shared app parts
- [x] `PlayerAvatar`: replace the emoji fallback with initials on a tier-coloured disc. Add an optional `name` prop for the initials. Keep the class names other screens use (`ds-pavatar`, `--pa-size`).
- [x] `TopNav` (`src/components/AuthShell.jsx`): restyle to the new nav (64px, gold bottom line, uppercase links, gold diamond on the current page). This changes the nav on every page on purpose. Keep the same links, labels and sign-out behaviour.
- [x] `Shell`: add a `page` prop for the main element class (default `ds-page`), so a moved screen can use `cb-page`.

### 1.6 Guard tests (`tests/ui-system.test.mjs`)
- [x] `ui.css` uses only the allowed radius values.
- [x] `ui.css` uses only the shared breakpoints.
- [x] `ui.css` has no `background-clip: text` (no gradient text).
- [x] `ui.css` has a `prefers-reduced-motion` block and a `(pointer: coarse)` block with `min-height: 44px`.
- [x] No component in `src/components` or `src/features` hardcodes a rank name from `RANK_NAMES`.
- [x] `PlayerAvatar.jsx` has no emoji.
- [x] `layout.tsx` loads Cormorant SC and Be Vietnam Pro with the `vietnamese` subset.

## Phase 2: Player profile (`/`, `/profile?u=`)

### 2.1 Page frame
- [x] `PlayerProfile.jsx` renders inside `Shell` with `page="cb-page"` and sets `data-tier` on the page wrapper.
- [x] Loading, error and "not found" states use `.cb-empty` / `Notice` inside the new page, not `ds-empty`.
- [x] Sign-in (no username) still uses `AuthShell`. Not in scope for this phase.

### 2.2 Hero (filigree card)
- [x] Framed avatar (176px, 128px on phones) with the player's name for the alt text and initials.
- [x] Name (Display XL), `@username` (muted), diamond rule, rank name from `RANK_NAMES` in the tier `hi` colour. No rank name when the player has no tier.
- [x] Crest: badge image (240px, 168px on phones), "Tier X", Elo. With no tier: show Elo only.
- [x] Tier light behind the crest. Hero gem on the top line.
- [x] Reveal animation on the badge, once on load. Off for reduced motion.
- [x] Phone (≤720px): crest on top, all centred.

### 2.3 Stat strip
- [x] Win rate (with wins · losses), Games (with last played date), Win streak (with best). Uses `computeDashboard`. Elo stays in the crest, not repeated here.
- [x] With no finished games: Games shows the total, the other cells show "–", and the notes say "No games yet".

### 2.4 Tabs
- [x] `Tabs` with Overview, Match history, Settings (Settings only for the signed-in owner). Same ids as today (`stats`, `games`, `settings`).

### 2.5 Overview tab
- [x] Recent form card (full width): hexagon W/L tokens, newest first, with screen-reader text, and a summary line ("7 wins in the last 10 games").
- [x] Games per week card: gold bars with a pointed top, the current week in the tier gem colour, labels, screen-reader summary.
- [x] Best partner card: framed avatar (96px), name as a profile link, "W–L together" and win rate. Hidden when there is no best partner.
- [x] Top partners card and Most faced card: ledger rows with framed avatar (44px), profile link, win bar, record and games.
- [x] To show partner avatars, `computeDashboard` keeps each player's `tier` and `profile_image_path`. Existing tests must still pass.
- [x] Empty: one `.cb-empty` message, "No finished games yet. Stats appear after the first game."

### 2.6 Match history tab
- [x] One filigree card titled "Match history" with All / Won / Lost filter chips.
- [x] New `src/components/ui/MatchRow.jsx` (not the old `MatchCard`, which the day page still uses): result word (Won / Lost) and date and time, the player's team, a gold "vs" diamond, the other team. The winning side gets the gold wash. The profile owner's name is Gold Hi. Names link to profiles.
- [x] Empty states: "No finished games yet." and "No games match this filter."
- [x] Phone: result line on top, teams below.

### 2.7 Settings tab
- [x] One filigree card "Edit profile".
- [x] Name: `Field` + `.cb-input` + primary "Save name". Same `saveName` action.
- [x] Username: read-only `.cb-input` with the hint "You sign in with this. Ask the organiser to change it." Replaces the info tooltip.
- [x] Profile picture: quiet button label "Choose picture" over a hidden file input, hint "JPEG, PNG or WebP, up to 5 MB. You crop it next." Same `ImageCropper` flow.
- [x] Restyle `ImageCropper` with the new classes (square card, `cb-btn`). Keep its behaviour.
- [x] Sign out: quiet button. Same action.
- [x] Notices (`state.notice`, `state.error`) use `Notice`.
- [x] All controls disabled while `state.busy`.

### 2.8 Clean-up of profile-only old CSS
- [x] Delete from `design.css` the rules only the profile used: `.ds-hero*`, `.ds-identity*`, `.ds-avatar`, `.ds-emblem*`, `.ds-username`, `.ds-rank-pill*`, `.ds-tile*`, `.ds-form`, `.ds-result`, `.ds-bars`, `.ds-bar*`, `.ds-list`, `.ds-settings`, `.ds-info`, the "rank theme on the profile page" block, and their lines in the responsive section. Check each with a search first; keep anything another screen uses.
- [x] Keep `portal-responsive.test.mjs` passing.

### 2.9 Checks
- [x] `node --test tests/`: no new failures (baseline: 3).
- [x] `npx tsc --noEmit` passes.
- [x] `npm run build` passes.
- [ ] In the browser, at 1280px and 390px: own profile (all three tabs), another player's profile (no Settings), a player with no games, tiers S and D, save name, choose picture and cancel, history filters, keyboard tab navigation, reduced motion.
  - Done 2026-11-05 (user `thang`, tier A): own profile, all three tabs, history filters, arrow keys on tabs, 1280px and 375px. Fixed: Elo decimals, recent-form row class clash, global input style overriding `cb-input`, nav and tabs cut off on phones.
  - Done 2026-11-05 (later): another player's profile (`hieu`, tier S): two tabs, no Settings, crest and tier colours correct. Tier D: the dev data has no D player (lowest is C), so I set `data-tier="D"` in the page and the D colours applied. 
  - Still to check: a player with no games (no such player in dev data), choose picture then cancel (needs a real file dialog), reduced motion (not emulated in the browser pane; covered only by the guard test for the CSS block).
- [x] Dashboard, ranking, day page and organiser still render (nav change only). Organiser checked on the sign-in screen only; I have no organiser login.
- [ ] Decide: "Games" in the stat strip uses `games_total` (14 for `thang`) while win rate and history count 18 finished games.
- [x] Removed the "Tier X" caption under the crest: the badge art already shows the letter (user decision).
- [ ] Save screenshots outside the repo and show them to the user.
- [x] Update `DESIGN.md` if anything changed during the build (added support colours).

## Phase 3: Dashboard and rank ladder (`/dashboard`)
- [x] Rank ladder: five tier steps as filigree cards with the badge, rank name from `RANK_NAMES`, tier light behind each badge. On phones: one compact row per tier (60px badge). One staggered reveal on load.
- [x] Days list: one filigree card, ledger rows (date, "N games · N players", gold chevron). Animated page background removed.
- [x] Delete the dashboard-only `ds-` rules (`.ds-ladder*`, `.ds-day*`, `.ds-dash*`, the background animation). Backup of the old file was only in the scratchpad.
- [x] Checked 2026-11-05 at 1024px and 375px for `thang`: no horizontal scroll, no console errors; `node --test tests/` 58 tests, same 3 old failures; `tsc` passes. Not run: `npm run build` (dev server is running), reduced motion in the browser.
- Decision 2026-11-05: profile "Games" now shows finished games (18 for `thang`), the same count as win rate and history.

## Phase 4: Rankings and day summary (`/ranking`, `/dashboard/<date>`)
- [x] Ranking table in a filigree card (`PlayerRanking.jsx`): real table, framed avatar, rank name under the name in the tier `hi` colour, tier badge, Elo in tabular numbers, the signed-in player's row washed in gold.
- [x] Day page: stat strip, `MatchRow` list (new neutral mode: `meta` column, "Won" tag on the winning side, `focusKey`, `viewer`), standings card with player filter. Collapsible on phones as before.
- [x] Deleted `MatchCard.jsx` and the `ds-ranking`, `ds-rank-*`, `ds-table`, `ds-dp-*` (except `.ds-dp-tag`, used by the organiser court label), `ds-daypage`, `ds-back`, `ds-username` rules from `design.css`.
- [x] Checked 2026-11-05 for `thang`: ranking at 1024px and 375px; day page `2026-11-03` at 1024px and 375px (standings toggle, player filter, Show all); profile Match history still renders 18 rows. Tests 58 (same 3 old failures); `tsc` passes. Fixed while checking: standings card lost its frame at 960px and below (`position: static` broke the corner brackets), and global `.tier` / `.elo` classes leaked into the table (renamed `cb-c-*`).
- Not checked: organiser signed-in screens (no login).

## Phase 5: Sign-in (`AuthShell`, `PlayerSignIn`)
- [x] Work-screen level: one filigree card, `Field`, `cb-input`, primary button, `Notice` for errors. Done for both the player and organiser sign-in (shared `AuthShell`). Checked at 1024px and 375px, including the wrong-password error. The eyebrow prop is gone (no kickers). Old `ds-auth*` CSS removed; `ds-title` and `ds-lead` stay for the organiser `Header` until Phase 6.

## Phase 6: Organiser (`/organiser`)
- [x] Work-screen level: open-ledger groups, court cards as filigree cards without corner diamonds, no glow, 44px targets, highest contrast. Organiser JSX now uses `cb-org-*` / `cb-court` classes and the shared `Card`, `Button`, `Field`, `Notice`. Decorative glyphs on buttons (↻ ✕ ⇄ 🏆 ⏳ 💤) are gone; the status flags (⚡ ☕ 💃 🚪) and streak icons stay because the help text explains them. Help text updated to the new button names. Checked 2026-11-06 at 1024px and 375px with a throw-away preview page of fake data (deleted afterwards): play screen, setup screen, no horizontal scroll, all buttons 36px+ (44px on touch).
- [x] Move the organiser off `globals.css`. The organiser no longer uses any `ds-` or old global class (only `ds-root`, the page wrapper). All `ds-org-*` and `.ds-dp-tag` rules are deleted from `design.css`. Not checked with a real organiser login or real data; the toast, help panel, manage-players list, match log and the not-organiser / error screens were not seen rendered.

## Phase 7: Remove the old system
- [ ] Delete `design.css` and `globals.css` once no `ds-` class or old global class is used.
- [ ] Remove Marcellus SC from `layout.tsx`.
- [ ] Move `portal-responsive.test.mjs` checks to `ui.css`.
- [ ] Update the `DESIGN.md` migration status.
