export default function ProfileSettings({ state, actions }) {
  return <div className="ds-settings">
    <form onSubmit={(event) => { event.preventDefault(); void actions.saveName(); }}>
      <label className="ds-field"><span className="ds-label">Name</span>
        <div className="ds-row">
          <input className="ds-input" type="text" maxLength={40} autoComplete="name" value={state.newName ?? state.profile.name ?? ""} onChange={(event) => actions.update({ newName: event.target.value })} />
          <button className="ds-btn" disabled={state.busy} type="submit">Save</button>
        </div>
      </label>
    </form>
    <form onSubmit={(event) => { event.preventDefault(); void actions.saveUsername(); }}>
      <label className="ds-field"><span className="ds-label">Username</span>
        <div className="ds-row">
          <input className="ds-input" type="text" maxLength={32} value={state.newUsername ?? state.profile.username} onChange={(event) => actions.update({ newUsername: event.target.value })} />
          <button className="ds-btn" disabled={state.busy} type="submit">Save</button>
        </div>
      </label>
    </form>
    {["profile"].map((kind) => <label className="ds-field" key={kind}>
      <span className="ds-label">{kind === "profile" ? "Profile" : "Background"} image · JPEG, PNG, or WebP · up to 5 MB</span>
      <input className="ds-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={state.busy} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        void actions.upload(kind, file);
      }} />
    </label>)}
    <button className="ds-btn tertiary" onClick={actions.signOut} disabled={state.busy}>Sign out</button>
  </div>;
}
