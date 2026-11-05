# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Members of a single badminton club, plus one organiser who runs each session. Members check their ranking, profile, game history and settings, often on a phone at the court. The organiser sets up the session, balances players across courts, and tracks player status.

## Product Purpose

Court Balancer helps a club run badminton sessions fairly and keeps a running ladder. The organiser gets balanced courts; members get a profile, an Elo score and a tier (D to S) that reflects how they play. Success is smooth sessions and members who return to check their rank.

## Positioning

A club-private, social ranking: one friendly club's ladder with its own in-joke rank names, not a public service or generic scoreboard.

## Operating Context

Played in person at a club session. The organiser works through setup, courts and player status (`/organiser`). Members sign in, land on the club dashboard (`/dashboard`, `/dashboard/<date>`), and open their public profile (`/`, `/profile?u=<username>`) with Dashboard, Games and Settings tabs. Backend is Supabase (database, game RPCs, player-profile Edge Function), reached through Next.js App Router.

## Capabilities and Constraints

- Tiers D, C, B, A, S with Elo; tier badges and profile photos (with cropping) represent players.
- Rank names are Vietnamese and come only from `src/lib/rank-names.js` (`RANK_NAMES`); never hardcode them.
- UI copy is English.
- Local development must use the development Supabase project and the public publishable key only, never production or service-role keys.

## Brand Commitments

Product name: Court Balancer. The playful Vietnamese rank names are part of the club's identity. The existing visual system is recorded in DESIGN.md.

## Evidence on Hand

Live app code under `src/`, existing design tokens in `src/app/design.css`, and DESIGN.md. No testimonials, usage numbers or external proof exist; do not invent them.

## Product Principles

- Fairness first: balanced courts and an honest ranking come before decoration.
- The club's own voice (rank names, in-jokes) outranks generic sports-app language.
- Phone-first at the court: quick to read and use between games.
- Players supply the colour: photos and tier badges carry personality.

## Accessibility & Inclusion

Target WCAG AA, with attention to phone use in bright gym lighting.
