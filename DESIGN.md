---
version: alpha
name: "Court Balancer: Emerald Crown Ranked"
description: >-
  A ranked-game world for one badminton club: night court green, gold trim,
  filigree-framed cards, and tier metals taken from the D–S rank badges.
  Approved from the v1 player profile prototype and card option B (2026-11-05).
colors:
  ground: "#061712"
  card: "#0a1f18"
  card-top: "#0f2c22"
  raised: "#133527"
  input-well: "#071a13"
  ink: "#f2ecdc"
  muted: "#a9bdb2"
  faint: "#7f978b"
  gold: "#e2bd62"
  gold-hi: "#f5dc98"
  gold-deep: "#9c7426"
  gold-pale: "#fff1c4"
  gold-shade: "#b98a2c"
  on-gold: "#1f1806"
  win-text: "#c9f5df"
  loss-text: "#ffd6dc"
  track: "#24382f"
  win: "#52dc9e"
  on-win: "#03170e"
  loss: "#e7a3ad"
  loss-fill: "#2a3d36"
  tier-s-hi: "#d4c6ff"
  tier-s-main: "#8a63ff"
  tier-s-deep: "#26134f"
  tier-a-hi: "#f5dc98"
  tier-a-main: "#d6a845"
  tier-a-deep: "#3a2a08"
  tier-b-hi: "#d8f1f3"
  tier-b-main: "#86c3cb"
  tier-b-deep: "#12323a"
  tier-c-hi: "#f2c39c"
  tier-c-main: "#c27c4a"
  tier-c-deep: "#2f1b0e"
  tier-d-hi: "#dcb391"
  tier-d-main: "#9a6a48"
  tier-d-deep: "#281a10"
  gem-emerald: "#3fd88f"
typography:
  display-xl: { fontFamily: "\"Cormorant SC\", Georgia, serif", fontSize: 56px, fontWeight: 700, lineHeight: 1 }
  display-lg: { fontFamily: "\"Cormorant SC\", Georgia, serif", fontSize: 28px, fontWeight: 600, lineHeight: 1.15 }
  title: { fontFamily: "\"Cormorant SC\", Georgia, serif", fontSize: 26px, fontWeight: 700, lineHeight: 1.1 }
  tab: { fontFamily: "\"Cormorant SC\", Georgia, serif", fontSize: 22px, fontWeight: 700, lineHeight: 1 }
  button: { fontFamily: "\"Cormorant SC\", Georgia, serif", fontSize: 19px, fontWeight: 700, lineHeight: 1 }
  stat: { fontFamily: "\"Be Vietnam Pro\", system-ui, sans-serif", fontSize: 34px, fontWeight: 700, lineHeight: 1.15 }
  body: { fontFamily: "\"Be Vietnam Pro\", system-ui, sans-serif", fontSize: 15px, fontWeight: 400, lineHeight: 1.5 }
  body-sm: { fontFamily: "\"Be Vietnam Pro\", system-ui, sans-serif", fontSize: 13px, fontWeight: 400, lineHeight: 1.45 }
  label: { fontFamily: "\"Be Vietnam Pro\", system-ui, sans-serif", fontSize: 12px, fontWeight: 600, lineHeight: 1.3, letterSpacing: "0.14em" }
rounded:
  none: "0px"
  input: "2px"
  avatar: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary: { backgroundColor: "{colors.gold}", textColor: "{colors.on-gold}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0 22px", height: "46px" }
  button-quiet: { backgroundColor: "{colors.raised}", textColor: "{colors.ink}", typography: "{typography.button}", rounded: "{rounded.none}", padding: "0 22px", height: "46px" }
  chip-filter: { backgroundColor: "transparent", textColor: "{colors.muted}", typography: "{typography.label}", rounded: "{rounded.none}", padding: "0 14px", height: "36px" }
  chip-filter-active: { backgroundColor: "{colors.gold}", textColor: "{colors.on-gold}" }
  tab: { backgroundColor: "transparent", textColor: "{colors.muted}", typography: "{typography.tab}", height: "52px", padding: "0 20px" }
  tab-active: { textColor: "{colors.gold-hi}" }
  card: { backgroundColor: "{colors.card}", rounded: "{rounded.none}", padding: "26px 30px" }
  text-input: { backgroundColor: "{colors.input-well}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.input}", padding: "0 14px", height: "46px" }
  top-nav: { backgroundColor: "#04110c", textColor: "{colors.muted}", height: "64px", padding: "0 24px" }
---

# Design System: Court Balancer

## Overview

**Creative North Star: "The club's ranked lobby"**

Court Balancer looks like the ranked screen of a fantasy game made for one badminton club. The ground is night court green. Content sits in square **filigree cards**: a double gold line with gold bracket corners. Colour comes from the five tier metals of the D–S badges (bronze, copper, silver, gold, amethyst), and each player's tier colours their own page. The badge and profile-frame art is the most detailed layer, and the UI around it stays simpler than the art.

The world is game-like, not a copy of a game. It uses our own badges, our own Vietnamese rank names, and free fonts. It takes no fonts, art or layouts from Riot or any other studio.

The amount of fantasy depends on the screen:

- **Show screens** (player profile, rank ladder, rankings, day summary): full treatment. Tier glow behind the hero, crest, filigree cards, one reveal animation.
- **Work screens** (organiser setup, courts, player status, settings forms, sign-in): the same tokens, but calm. No glow behind content, no animation, larger tap targets, highest contrast. Groups use the open ledger (heading and gold rule, no box) or a filigree card without corner diamonds.

**Key Characteristics:**
- Dark, green-black ground with tier-coloured light behind the hero only.
- Square filigree cards: double gold line, bracket corners with a diamond. No rounded cards.
- Display serif for names, titles, tabs and buttons. Sans-serif for body text and all numbers.
- Tier metals are the only colour system for rank. Emerald and rose only mean win and loss.
- One authored motion moment per screen: the badge reveal.

## Colors

Night green and gold, with five tier metals that theme the page by rank.

### Primary
- **Gold** (#e2bd62): card lines and corners, the primary button, active nav marker, diamond dividers. Focus rings use **Gold Hi** (#f5dc98).
- **Gold Deep** (#9c7426): bottom stop of gold bars. **Gold Shade** (#b98a2c): bottom stop of the button gradient.
- **Gold Pale** (#fff1c4): hover colour for gold links.

### Support
- **Win Text / Loss Text** (#c9f5df / #ffd6dc): text inside status and error notices.
- **Track** (#24382f): the empty part of win bars.
- **Scrim** (Ground-black at 78%): behind dialogs.

### Tier metals
Each tier has three values: `hi` (text on dark, the rank name), `main` (glow, avatar fill), `deep` (avatar shading). The page sets one tier attribute (`data-tier="S"` … `"D"`) and every tier-aware part reads it.
- **S, amethyst** (#8a63ff), **A, gold** (#d6a845), **B, silver-teal** (#86c3cb), **C, copper** (#c27c4a), **D, bronze** (#9a6a48).

### Result colours
- **Win** (#52dc9e) with dark text (#03170e) on fills. Wins, positive bars, "Won".
- **Loss** (#e7a3ad) text on **Loss Fill** (#2a3d36). Losses are dim, not alarming.

### Neutral
- **Ground** (#061712): page background.
- **Card / Card Top** (#0a1f18 / #0f2c22): card face, a vertical gradient from Card Top to Card.
- **Raised** (#133527): quiet buttons, hover rows.
- **Ink** (#f2ecdc): main text. **Muted** (#a9bdb2): labels and notes. **Faint** (#7f978b): chart axis labels only.

### Named Rules
**The Metal Means Rank Rule.** Tier colours appear only where a tier is meant: a player's own page theme, their avatar frame, their badge. Never use a tier colour as decoration on a neutral component.

**The Win/Loss Lightness Rule.** Win and loss must differ in lightness and always carry a letter or word (W/L, Won/Lost), never colour alone.

## Typography

**Display Font:** Cormorant SC (with Georgia)
**Body Font:** Be Vietnam Pro (with system-ui)

**Character:** A carved small-caps serif for the voice of the game, paired with a clear Vietnamese-made sans for everything a player reads quickly. Both fonts support Vietnamese, so rank names and player names render in one font with no fallback letters. (Marcellus SC, the old display font, has no Vietnamese letters.)

### Hierarchy
- **Display XL** (700, 56px, 1.0): the player's name on their profile. 40px on phones.
- **Display LG** (600, 28px, 1.15): the Vietnamese rank name under the player's name, in the tier `hi` colour.
- **Title** (700, 26px, 1.1): card headings ("Recent form", "Match history").
- **Tab / Button** (700, 22px / 19px): tabs and buttons use the display font.
- **Stat** (Be Vietnam Pro 700, 34px): all big numbers (Elo, win rate, games). 26px on phones.
- **Body** (400, 15px, 1.5): text. **Body SM** (13px): notes and meta.
- **Label** (600, 12px, 0.14em, uppercase): stat labels, form labels, nav links.

### Named Rules
**The Numbers Are Sans Rule.** Every number uses the body font with tabular figures (`font-variant-numeric: tabular-nums`). Never set Elo, scores or counts in the display serif.

## Layout

- Content width: 1040px max, 24px side padding (16px on phones).
- Vertical rhythm between cards: 24px (18px on phones). Inside a card: 26px top, 30px sides (18px on phones).
- Overview content uses a 2-column grid with a 20px gap. It becomes 1 column at 720px and below.
- Breakpoints are the shared ones: 960, 720, 480, 360 (max-width).
- Profile order: hero, then stat strip, then tabs, then the tab panel.
- Touch targets are at least 44px high.

## Elevation & Depth

No drop shadows on cards or buttons. Depth comes from the double gold line, the face gradient (lighter at the top), and the tier-coloured light behind the hero. A blurred glow is allowed only behind a badge or the avatar on show screens. Avatar frames may have a small drop shadow so they sit above the card.

### Named Rules
**The Light Behind Rule.** Glow is light from behind an emblem, never a halo around a box or a button.

## Shapes

- **Cards are square.** The frame is a 1px gold line (50% opacity) with a second 1px line inset 5px (18% opacity).
- **Bracket corners:** a 22px gold L (2px) on each corner with a 6px gold diamond inside it. On phones the bracket is 16px and the diamond 5px.
- **Buttons and filter chips** have pointed ends (hexagonal silhouette, 10px and 8px points).
- **Form tokens** (W/L) are hexagons.
- **Diamonds** (a 45° square, 6–9px) are the ornament: dividers, the active tab marker, the active nav marker, the hero gem.
- **Round** only for avatars (the frame art has a round opening).
- **Inputs** have a 2px radius. No other radius exists.

## Components

### Card (filigree frame)
- Square, double gold line, four bracket corners with diamonds. Face: Card Top → Card gradient. Padding 26px 30px 18px.
- **Head:** title centred, note under it, then a short diamond rule (160px). For dense work screens the head may sit left with the note on the right.
- **Foot:** an optional centred text link in label style ("See all partners").
- Cards never nest. Inside a card, group with spacing and 1px hairlines (gold at 12%).

### Buttons
- **Shape:** pointed ends, 46px high, display font 19px.
- **Primary:** vertical gold gradient (#f6dc95 → #d6a845 → #b98a2c), text On Gold. One per card.
- **Quiet:** Raised fill, Ink text. Sign out, choose picture, cancel.
- **Hover:** brightness up and 1px lift. **Active:** back down. **Disabled:** Raised fill, Faint text, no lift. **Focus:** 2px Gold Hi ring, 3px offset.

### Tabs
- Display font 22px on a row with a 1px gold-tint bottom line.
- Active: Gold Hi text, a gold underline that fades at both ends, and a tier-gem diamond on the line. Arrow keys move between tabs.

### Filter chips
- Pointed ends, 36px high (44px on touch), uppercase label. Active: gold fill with On Gold text, and `aria-pressed="true"`.

### Hero (profile)
- Two columns inside one filigree card with tier light behind the crest: identity (framed avatar 176px, name, @username, diamond rule, rank name) and crest (badge 240px, which already shows the tier letter, then Elo). On phones the crest moves to the top and everything centres.

### Stat strip
- One card split into equal cells by fading hairlines with a gold diamond on each line. Label, number, note. It replaces separate stat tiles.

### Framed avatar
- The tier frame image over a round photo inset at 21%. Without a photo, show the player's initials on a tier-coloured disc (never an emoji). Sizes: 176 (hero), 96 (feature), 44 (lists).

### Inputs / Fields
- Input Well fill, 1px gold-tint border, 2px radius, 46px high, 16px text. Label above in label style, hint below in Body SM.
- **Focus:** gold border plus a 3px soft gold ring. **Read-only:** dashed border, transparent fill, muted text, and a hint that says why.

### Navigation
- 64px, near-black, with a gold line that fades at both ends along the bottom.
- Links: uppercase label style. The current page is Gold Hi with a gold diamond under it. On phones the brand text hides and the links stay.

### Notices
- Status: emerald tint with a 1px emerald border and a diamond bullet. Error: rose tint with a 1px rose border.

## Do's and Don'ts

### Do:
- **Do** set the tier once on the page root (`data-tier`) and let every tier-aware part read it.
- **Do** keep one reveal animation (badge scale and blur in, about 1.1s, ease-out) per show screen, and switch it off for `prefers-reduced-motion`.
- **Do** theme browser parts: text selection in gold, a gold caret, and gold focus rings.
- **Do** show players everywhere with the framed avatar and their name.
- **Do** take rank names only from `src/lib/rank-names.js`.
- **Do** build screens from the shared components in `src/components/ui/` and the `cb-` classes in `src/app/ui.css`.

### Don't:
- **Don't** use rounded cards, pills, or any radius other than 2px (inputs) and full (avatars).
- **Don't** nest cards or put a card inside a card.
- **Don't** use drop shadows on cards or buttons, or glow around boxes.
- **Don't** use gradient text. Emphasis comes from the display font, size and the tier `hi` colour.
- **Don't** use tier colours on work screens except in avatar frames and badges.
- **Don't** add ambient motion (particles, turning rays) to any screen.
- **Don't** use emoji as icons. Use drawn SVG or the badge and frame art.

## Migration status

The redesign runs screen by screen. The plan and checklist live in `spec/plan/2026-11-05-emerald-crown-redesign.md`.

- New system: `src/app/ui.css` (`cb-` classes and `--cb-` tokens) and `src/components/ui/`.
- Old system, still used by screens not yet moved: `src/app/design.css` (`ds-` classes) and `src/app/globals.css` (organiser).
- References: v1 profile prototype https://claude.ai/artifact/3ZcNJNkqbV5UgRu4f4UJCT and card options https://claude.ai/artifact/Qo2CDrqv5Y1YXHuHw5AVoK (option B) (both private).
