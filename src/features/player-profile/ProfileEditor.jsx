import { useRef } from "react";

export default function ProfileEditor({ state, actions }) {
  const passwordInput = useRef(null);
  if (!state.loggedIn) return <form className="card" onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
    <div className="label" style={{ marginBottom: 8 }}>Player sign in</div>
    <input type="text" aria-label="Username" autoComplete="username" value={state.loginUsername} placeholder="Username" onChange={(event) => actions.update({ loginUsername: event.target.value })}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); passwordInput.current?.focus(); } }} />
    <input ref={passwordInput} type="password" aria-label="Password" autoComplete="current-password" value={state.password} placeholder="Password" style={{ marginTop: 8 }} onChange={(event) => actions.update({ password: event.target.value })} />
    <button className="btn big" style={{ marginTop: 12 }} disabled={state.busy} type="submit">Sign in</button>
    <p className="hint">The first password entered for an unclaimed username becomes its password.</p>
  </form>;

  return <div className="card">
    <div className="card-head"><div className="label">Edit profile</div><span className="hint">Signed in as {state.profile.username}</span></div>
    <form onSubmit={(event) => { event.preventDefault(); void actions.saveUsername(); }}>
      <label className="profile-field"><span>Username</span><div className="player-row">
        <input type="text" maxLength={32} value={state.newUsername ?? state.profile.username} onChange={(event) => actions.update({ newUsername: event.target.value })} />
        <button className="btn subtle" disabled={state.busy} type="submit">Save</button>
      </div></label>
    </form>
    {["profile", "background"].map((kind) => <label className="profile-field" key={kind}>
      <span>{kind === "profile" ? "Profile" : "Background"} image · JPEG, PNG, or WebP · up to 5 MB</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={state.busy} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void actions.upload(kind, file);
      }} />
    </label>)}
    <button className="mini-btn" onClick={actions.signOut} disabled={state.busy}>Sign out</button>
  </div>;
}
