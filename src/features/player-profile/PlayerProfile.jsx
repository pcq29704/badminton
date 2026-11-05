"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import AuthShell from "@/components/AuthShell";
import Shell from "@/components/Shell";
import LocalDate from "@/components/LocalDate";
import { Card, Notice, StatStrip, Tabs, tabPanelProps } from "@/components/ui";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { RANK_NAMES } from "@/lib/rank-names";
import PlayerAvatar, { tierKey } from "../../components/PlayerAvatar";
import { computeDashboard } from "./dashboard.mjs";
import { usePlayerProfile } from "./usePlayerProfile";
import { useViewer } from "./useViewer";
import PlayerSignIn from "./PlayerSignIn";
import ProfileSettings from "./ProfileSettings";
import ProfileHistory from "./ProfileHistory";
import ProfileStats from "./ProfileStats";

// Identity on the left, rank crest on the right (DESIGN.md, Components > Hero). The tier comes from data-tier on the page.
function ProfileHero({ profile, rank }) {
  const name = profile.name || profile.username;
  return <Card className="cb-hero" aria-label="Player">
    <span className="cb-hero-gem" aria-hidden="true" />
    <div className="cb-hero-who">
      <PlayerAvatar className="cb-hero-avatar" path={profile.profile_image_path} tier={profile.tier} name={name} alt={`${name} profile picture`} />
      <div className="cb-hero-text">
        <h1 className="cb-hero-name">{name}</h1>
        {profile.username && <p className="cb-note">@{profile.username}</p>}
        {rank && <>
          <span className="cb-rule" aria-hidden="true"><i /></span>
          <p className="cb-hero-rank">{RANK_NAMES[rank]}</p>
        </>}
      </div>
    </div>
    <div className="cb-crest">
      {rank && <div className="cb-crest-art"><img src={`/assets/rank-badges/rank-${rank.toLowerCase()}.png`} alt={`Tier ${rank} badge`} width="240" height="240" /></div>}
      <p className="cb-crest-elo"><b>{profile.elo == null ? "–" : Math.round(profile.elo)}</b><span className="cb-label">Elo</span></p>
    </div>
  </Card>;
}

function summaryItems(profile, stats) {
  const played = stats?.played || 0;
  return [
    played
      ? { label: "Win rate", value: stats.winRate, unit: "%", note: `${stats.wins} wins · ${stats.losses} losses` }
      : { label: "Win rate", value: "–", note: "No games yet" },
    { label: "Games", value: played, note: stats?.lastPlayed ? <>Last on <LocalDate value={stats.lastPlayed} options={{ day: "numeric", month: "short" }} /></> : "No games yet" },
    played
      ? { label: "Win streak", value: stats.streak, note: `Best ${stats.bestStreak}` }
      : { label: "Win streak", value: "–", note: "No games yet" },
  ];
}

// Public profile and player sign-in. Signing in sends the player to the dashboard at /dashboard.
export default function PlayerProfile({ initialUsername = "" }) {
  const router = useRouter();
  const { state, actions } = usePlayerProfile({ initialUsername, onSignedIn: () => router.replace("/dashboard") });
  const { viewer } = useViewer();
  const [tab, setTab] = useState("stats");
  const profile = state.profile;
  const stats = useMemo(() => (profile ? computeDashboard(profile.history, profile.username) : null), [profile]);
  // The nav shows who is signed in, even while someone else's profile is open.
  const shell = { current: state.loggedIn ? "profile" : "", viewer, onSignOut: actions.signOut };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (!state.initialized) return <Shell {...shell} page="cb-page"><p className="cb-empty" role="status">Loading player profile…</p></Shell>;
  if (!state.username) return <AuthShell current="player" title="Open your profile." lead="Sign in to see your rating, results, and partners." cardTitle="Sign in to Court Balancer">
    <PlayerSignIn state={state} actions={actions} />
  </AuthShell>;
  if (!profile) return <Shell {...shell} page="cb-page">
    {state.error ? <Notice tone="error">{state.error}</Notice> : <p className="cb-empty" role="status">Loading player profile…</p>}
    {state.error && <PlayerSignIn state={{ ...state, error: "" }} actions={actions} />}
  </Shell>;

  const tabs = [{ id: "stats", label: "Overview" }, { id: "games", label: "Match history" }, ...(state.loggedIn ? [{ id: "settings", label: "Settings" }] : [])];
  const active = tabs.some(({ id }) => id === tab) ? tab : "stats";
  // The rank sets the page colours (data-tier, see ui.css).
  const rank = tierKey(profile.tier).toUpperCase();
  const notices = <>
    <Notice>{state.notice}</Notice>
    {state.loggedIn && <Notice tone="error">{state.error}</Notice>}
  </>;
  return <Shell {...shell} page="cb-page cb-profile" pageProps={{ "data-tier": rank || undefined, "aria-busy": state.busy || undefined }}>
    <ProfileHero profile={profile} rank={rank} />
    <StatStrip label="Summary" items={summaryItems(profile, stats)} />
    <Tabs tabs={tabs} active={active} onChange={setTab} label="Profile sections" idBase="profile" />
    {active !== "settings" && notices}
    <div {...tabPanelProps("profile", active)} className="cb-panel">
      {active === "stats" && <ProfileStats stats={stats} />}
      {active === "games" && <ProfileHistory games={profile.history || []} username={profile.username} />}
      {active === "settings" && <ProfileSettings state={state} actions={actions} notices={notices} />}
    </div>
  </Shell>;
}
