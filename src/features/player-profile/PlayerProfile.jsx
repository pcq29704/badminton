"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import AuthShell from "@/components/AuthShell";
import Shell from "@/components/Shell";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";
import { profileImageUrl } from "./api";
import PlayerSignIn from "./PlayerSignIn";
import ProfileSettings from "./ProfileSettings";
import ProfileHistory from "./ProfileHistory";
import ProfileStats from "./ProfileStats";

// Public profile and player sign-in. Signing in sends the player to the dashboard at /dashboard.
export default function PlayerProfile() {
  const router = useRouter();
  const { state, actions } = usePlayerProfile({ onSignedIn: () => router.replace("/dashboard") });
  const [tab, setTab] = useState("stats");
  const profile = state.profile;
  const current = "player";

  if (!hasSupabaseConfig) return <Shell current={current}><ConfigurationMessage /></Shell>;
  if (!state.initialized) return <Shell current={current}><p className="ds-empty">Loading player profile…</p></Shell>;
  if (!state.username) return <AuthShell current="player" eyebrow="Player" title="Open your profile." lead="Sign in to see your rating, results, and partners." cardTitle="Sign in to Court Balancer">
    <PlayerSignIn state={state} actions={actions} />
  </AuthShell>;
  if (!profile) return <Shell current={current}>
    {state.error ? <p className="ds-alert error" role="alert">{state.error}</p> : <p className="ds-empty">Loading player profile…</p>}
    {state.error && <PlayerSignIn state={{ ...state, error: "" }} actions={actions} />}
  </Shell>;

  const tabs = [["stats", "Stats"], ["games", "Games"], [state.loggedIn ? "settings" : "signin", state.loggedIn ? "Settings" : "Sign in"]];
  const active = tabs.some(([id]) => id === tab) ? tab : "stats";
  const cover = profile.background_image_path ? { backgroundImage: `url("${profileImageUrl(profile.background_image_path)}")` } : undefined;
  return <Shell current={current}>
    <div className={state.busy ? "ds-busy" : undefined}>
      <section className="ds-hero" style={cover} aria-label="Profile cover" />
      <div className="ds-identity">
        {profile.profile_image_path
          ? <img className="ds-avatar" src={profileImageUrl(profile.profile_image_path)} alt={`${profile.username} profile image`} />
          : <div className="ds-avatar" aria-hidden="true">🏸</div>}
        <div className="ds-identity-text">
          <h1 className="ds-username">{profile.username}</h1>
          <p className="ds-sub"><span className={`ds-tier t-${profile.tier}`}>{profile.tier}</span> tier · Elo {profile.elo} · {profile.games_total} games</p>
        </div>
      </div>
      {state.notice && <p className="ds-alert" role="status">{state.notice}</p>}
      {state.error && state.loggedIn && <p className="ds-alert error" role="alert">{state.error}</p>}
      <div className="ds-tabs" role="tablist" aria-label="Profile sections">
        {tabs.map(([id, label]) => <button key={id} className="ds-chip" role="tab" aria-selected={active === id} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {active === "stats" && <ProfileStats profile={profile} />}
      {active === "games" && <div className="ds-section"><h2 className="ds-h2">Finished games</h2><ProfileHistory games={profile.history} /></div>}
      {active === "signin" && <div className="ds-section ds-settings"><h2 className="ds-card-title">Sign in to edit</h2><PlayerSignIn state={state} actions={actions} /></div>}
      {active === "settings" && <div className="ds-section"><h2 className="ds-h2">Edit profile</h2><ProfileSettings state={state} actions={actions} /></div>}
    </div>
  </Shell>;
}
