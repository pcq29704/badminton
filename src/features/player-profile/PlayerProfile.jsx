"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import AuthShell from "@/components/AuthShell";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";
import { useViewer } from "./useViewer";
import PlayerAvatar, { RankIcon, tierKey } from "../../components/PlayerAvatar";
import PlayerSignIn from "./PlayerSignIn";
import ProfileSettings from "./ProfileSettings";
import ProfileHistory from "./ProfileHistory";
import ProfileStats from "./ProfileStats";

// Metal name of each rank badge, shown next to the rank letter.
const RANK_NAMES = { S: "Iridescent", A: "Gold", B: "Silver", C: "Copper", D: "Bronze" };

// Public profile and player sign-in. Signing in sends the player to the dashboard at /dashboard.
export default function PlayerProfile() {
  const router = useRouter();
  const { state, actions } = usePlayerProfile({ onSignedIn: () => router.replace("/dashboard") });
  const { viewer, signOut: signOutViewer } = useViewer();
  const [tab, setTab] = useState("stats");
  const profile = state.profile;
  // The nav shows who is signed in, even while someone else's profile is open.
  const shell = { current: state.loggedIn ? "profile" : "", viewer, onSignOut: () => { void signOutViewer(); actions.signOut(); } };

  if (!hasSupabaseConfig) return <Shell {...shell}><ConfigurationMessage /></Shell>;
  if (!state.initialized) return <Shell {...shell}><p className="ds-empty">Loading player profile…</p></Shell>;
  if (!state.username) return <AuthShell current="player" eyebrow="Player" title="Open your profile." lead="Sign in to see your rating, results, and partners." cardTitle="Sign in to Court Balancer">
    <PlayerSignIn state={state} actions={actions} />
  </AuthShell>;
  if (!profile) return <Shell {...shell}>
    {state.error ? <p className="ds-alert error" role="alert">{state.error}</p> : <p className="ds-empty">Loading player profile…</p>}
    {state.error && <PlayerSignIn state={{ ...state, error: "" }} actions={actions} />}
  </Shell>;

  const tabs = [["stats", "Overview"], ["games", "Match history"], ...(state.loggedIn ? [["settings", "Settings"]] : [])];
  const active = tabs.some(([id]) => id === tab) ? tab : "stats";
  // Custom background images are hidden for now; the hero falls back to the rank mark.
  const cover = undefined;
  // The rank sets the page colour theme (see "rank theme" in design.css).
  const rank = tierKey(profile.tier).toUpperCase();
  return <Shell {...shell}>
    <div className={`ds-profile${state.busy ? " ds-busy" : ""}`} data-tier={rank || undefined}>
      <section className={`ds-hero${!cover && rank ? " ds-hero-rank" : ""}`} style={cover} aria-label="Profile cover">
        {!cover && rank && <img className="ds-hero-mark" src={`/assets/rank-badges/rank-${rank.toLowerCase()}.png`} alt="" aria-hidden="true" />}
      </section>
      <div className="ds-identity">
        <PlayerAvatar className="ds-avatar" path={profile.profile_image_path} tier={profile.tier} alt={`${profile.name || profile.username} profile image`} />
        <div className="ds-identity-text">
          <h1 className="ds-username">{profile.name || profile.username}</h1>
          <p className="ds-sub">Elo {profile.elo} · {profile.games_total} games</p>
          {rank && <span className="ds-rank-pill"><RankIcon tier={rank} className="ds-rank-pill-icon" />Rank {rank} · {RANK_NAMES[rank]}</span>}
        </div>
        <div className="ds-emblem"><RankIcon tier={profile.tier} className="ds-emblem-icon" /></div>
      </div>
      {state.notice && <p className="ds-alert" role="status">{state.notice}</p>}
      {state.error && state.loggedIn && <p className="ds-alert error" role="alert">{state.error}</p>}
      <div className="ds-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map(([id, label]) => <button key={id} className="ds-chip" role="tab" aria-selected={active === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {active === "stats" && <ProfileStats profile={profile} />}
      {active === "games" && <div className="ds-section"><ProfileHistory games={profile.history} username={profile.username} /></div>}
      {active === "settings" && <div className="ds-section"><h2 className="ds-h2">Edit profile</h2><ProfileSettings state={state} actions={actions} /></div>}
    </div>
  </Shell>;
}
