"use client";

import ConfigurationMessage from "@/components/ConfigurationMessage";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { usePlayerProfile } from "./usePlayerProfile";
import { profileImageUrl } from "./api";
import ProfileEditor from "./ProfileEditor";
import ProfileHistory from "./ProfileHistory";

export default function PlayerProfile() {
  const { state, actions } = usePlayerProfile();
  const profile = state.profile;
  return <main className={`wrap${state.busy ? " busy" : ""}`}>
    <header id="app-header"><div style={{ fontSize: 46 }}>🏸</div><h1>Player profile</h1><p className="sub"><a href="/">Court Balancer</a></p></header>
    {!hasSupabaseConfig ? <ConfigurationMessage /> : <>
      {state.error && <div className="toast error profile-message" role="alert">{state.error}</div>}
      {state.notice && <div className="toast profile-message" role="status">{state.notice}</div>}
      {!state.initialized ? <div className="card center"><p className="hint">Loading player profile…</p></div>
        : !state.username ? <div className="card center"><p>Open a player profile using its username, for example <code>profile.html?u=sam</code>.</p></div>
        : profile ? <>
          <section className="profile-cover" style={profile.background_image_path ? { backgroundImage: `linear-gradient(90deg, rgba(12,48,40,.76), rgba(12,48,40,.16)), url("${profileImageUrl(profile.background_image_path)}")` } : undefined}>
            <div className="profile-identity">
              {profile.profile_image_path ? <img className="profile-avatar" src={profileImageUrl(profile.profile_image_path)} alt={`${profile.username} profile image`} /> : <div className="profile-avatar profile-avatar-empty" aria-hidden="true">🏸</div>}
              <div><div className="profile-username">{profile.username}</div><div className="profile-rank">{profile.tier} tier · Elo {profile.elo}</div></div>
            </div>
          </section>
          <div className="profile-stats">{[["Elo", profile.elo], ["Tier", profile.tier], ["Total games", profile.games_total]].map(([label, value]) => <div className="card center" key={label}><div className="label">{label}</div><strong>{value}</strong></div>)}</div>
          <ProfileEditor state={state} actions={actions} />
          <div className="card"><div className="card-head"><div className="label">Finished games</div><span className="hint">{profile.history.length} total</span></div><ProfileHistory games={profile.history} /></div>
        </> : !state.error && <div className="card center"><p className="hint">Loading player profile…</p></div>}
    </>}
  </main>;
}
