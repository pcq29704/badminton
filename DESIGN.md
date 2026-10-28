---
version: alpha
name: "Court Balancer (Snapchat-derived)"
description: >-
  Design system for the player profile, player dashboard, and sign-in screens.
  Derived from the Snapchat desktop chrome: pure white canvas, graphite pill
  CTAs, Avenir Next at modest weights, a binary radius scale (100px pills,
  20px tiles), no shadows. Colour comes from content (cover photos, avatars,
  tier badges), never from the chrome.
source: "https://www.snapchat.com"

colors:
  primary: "#0b3d2e"
  primary-hover: "#072a1f"
  accent: "#0b8a5f"
  accent-active: "#097a53"
  shuttle: "#d7f04a"
  tint-mint: "#e3f6ee"
  tint-lime: "#f1f9cf"
  tint-sky: "#e0efff"
  tint-sand: "#fff3dc"
  ink: "#0a1f18"
  ink-soft: "#0b3d2e"
  ink-muted: "#4f5f59"
  ink-tertiary: "#cccccc"
  canvas: "#ffffff"
  surface-1: "#f4f8f6"
  surface-2: "#e9f0ed"
  hairline: "#dde8e3"
  hairline-soft: "#e6efeb"
  alert-red: "#f23c57"
  alert-yellow: "#ffc131"
  brand-yellow: "#fffc00"

typography:
  display-xl: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 48px, fontWeight: 600, lineHeight: 60px }
  display-md: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 28px, fontWeight: 700, lineHeight: 36px }
  heading-md: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 22px, fontWeight: 600, lineHeight: 28px }
  heading-sm: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 16px, fontWeight: 500, lineHeight: 24px }
  body-md: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 14px, fontWeight: 500, lineHeight: 20px }
  body-sm: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 14px, fontWeight: 400, lineHeight: 17px }
  label-md: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 14px, fontWeight: 500, lineHeight: 16px }
  caption: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 12px, fontWeight: 600, lineHeight: 16px }
  button-md: { fontFamily: "\"Avenir Next\", Helvetica, sans-serif", fontSize: 14px, fontWeight: 500, lineHeight: 16px }

rounded:
  none: "0px"
  xs: "5px"
  sm: "8px"
  md: "20px"
  pill: "100px"
  full: "9999px"

spacing:
  xs: "4px"
  sm: "8px"
  md: "10px"
  base: "15px"
  lg: "20px"
  xl: "35px"

components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.canvas}", typography: "{typography.button-md}", rounded: "{rounded.pill}", padding: "8px 16px", height: "32px" }
  button-primary-hover: { backgroundColor: "{colors.primary-hover}", textColor: "{colors.canvas}" }
  button-secondary: { backgroundColor: "{colors.accent}", textColor: "{colors.canvas}", typography: "{typography.button-md}", rounded: "{rounded.pill}", padding: "12px 20px", height: "44px" }
  button-tertiary: { backgroundColor: "{colors.surface-2}", textColor: "{colors.primary}", typography: "{typography.button-md}", rounded: "{rounded.pill}", padding: "8px 16px", height: "32px" }
  top-nav: { backgroundColor: "{colors.canvas}", textColor: "{colors.ink}", height: "72px", padding: "8px 16px" }
  nav-chip: { backgroundColor: "transparent", textColor: "{colors.ink-soft}", typography: "{typography.label-md}", rounded: "{rounded.pill}", padding: "8px 12px" }
  tile: { backgroundColor: "{colors.surface-1}", rounded: "{rounded.md}", padding: "20px" }
  text-input: { backgroundColor: "{colors.surface-2}", textColor: "{colors.ink-soft}", typography: "{typography.heading-sm}", rounded: "{rounded.xs}", padding: "7px", height: "38px" }
---

## Overview

Chrome is neutral; content carries the colour. The canvas is pure white, text is
ink black or graphite, and every primary action is a graphite `{colors.primary}`
(#0b3d2e) pill. Brand yellow `{colors.brand-yellow}` is **not used** in this app.
A single court-green accent `{colors.accent}` marks the main sign-in action and focus
rings.

In this app the "product screenshots" that supply colour are the player's own
content: the cover photo, the avatar, and the tier badges (S, A, B, C, D).

## Theme: Court Green

The Snapchat structure (white canvas, pills, 20px tiles, no shadows) is kept; the
neutrals and the accent are tuned to a badminton court.

- **Primary** `{colors.primary}` #0b3d2e, deep court green. Primary pills, active tabs, nav chips.
- **Accent** `{colors.accent}` #0b8a5f. Sign-in submit, focus rings, W chips, chart bars. White text on it passes 4.5:1.
- **Shuttle** `{colors.shuttle}` #d7f04a. Highlight only (small dots, badges). Never a button or tile fill.
- **Tints** mint, lime, sky, sand. Fills for the four headline dashboard tiles and the sign-in preview tiles.
- **Neutrals** carry a faint green cast: surface-1 #f4f8f6, surface-2 #e9f0ed, hairline #dde8e3.

All values are CSS variables on `.ds-root` in `src/app/design.css`, so a new theme is one block of edits.

## Where it applies

Scope of this system: the signed-in club dashboard (`/dashboard` and `/dashboard/<date>`, where players land after sign-in), the public player profile (`/`, `/profile.html`), its
Dashboard / Games / Settings tabs, the player sign-in, the organiser
sign-in, and the organiser court screens (`/organiser`: setup, courts, player status).
All styles live in `src/app/design.css` under the `.ds-root` class. The organiser screens add
`.ds-org` and use `ds-org-*` classes; they show each player with the profile picture inside the tier frame.

## Colors

- **Canvas** `{colors.canvas}`: page background.
- **Surface-1** `{colors.surface-1}`: tiles (stats, history rows, dashboard cards).
- **Surface-2** `{colors.surface-2}`: text inputs, tertiary pills, "loss" markers.
- **Ink / Ink Soft**: headings and primary text. **Ink Muted** `{colors.ink-muted}`: body copy, labels.
- **Hairline** `{colors.hairline}`: dividers and outlined white tiles.
- **Alert Red** `{colors.alert-red}`: error messages only.

## Typography

Avenir Next, falling back to Nunito Sans, then Helvetica. Weights 400–700 only.

| Token | Size / weight | Use |
|---|---|---|
| display-xl | 48 / 600 | Auth page title, profile username (desktop) |
| display-md | 28 / 700 | Card titles ("Sign in") |
| heading-md | 22 / 600 | Tile values and section titles |
| heading-sm | 16 / 500 | Inputs, tile labels |
| body-md | 14 / 500 | Body text, pill labels |
| caption | 12 / 600 | Eyebrows, hints, badges |

Do not bump the 48px title to weight 700.

## Layout

- 4px base unit, 8px module. Page content is capped at 1120px (auth) or 880px (profile).
- Top nav is 72px, white, with a hairline bottom border.
- Dashboard tiles sit in a responsive grid, 16px gap, and collapse to one column under 640px.

## Elevation

None. No drop shadows. Tiles lift through the tonal gap between `{colors.surface-1}` and the white canvas.

## Shapes

Binary scale. **100px** for every interactive chip (buttons, tabs, nav chips).
**20px** for every content tile. **5px** only for text inputs. **9999px** for avatars.
No 12px or 16px tier.

## Components

- **button-primary**: graphite pill, white label, 32px high. Hover goes to #000.
- **button-secondary**: green accent pill, 44px high. Used once per screen for the sign-in submit.
- **button-tertiary**: `{colors.surface-2}` pill. Used for sign out, upload, and cancel.
- **tabs**: row of nav-chips. The active tab is a graphite pill with white text; others are transparent.
- **tile**: `{colors.surface-1}`, 20px radius, 20px padding, no border, no shadow.
- **result chip** (dashboard form strip): 28px circle, graphite with "W", `{colors.surface-2}` with "L".
- **text-input**: `{colors.surface-2}` fill, 5px radius, 40px high, label above in caption style.

## Do's and Don'ts

- **Do** keep primary actions graphite and pill shaped.
- **Do** let cover photos and avatars supply colour.
- **Don't** use yellow fills, drop shadows, or a 12–16px radius.
- **Don't** use gradients on the canvas.
- **Do** show players on the organiser screens with `PlayerTag` (photo, tier frame, name).

## Known gaps

Avenir Next only ships on Apple platforms; other platforms fall back to Nunito
Sans if installed, then Helvetica or Arial. No webfont is bundled.
