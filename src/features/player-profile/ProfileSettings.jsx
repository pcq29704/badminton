import { useState } from "react";
import ImageCropper from "./ImageCropper";

export default function ProfileSettings({ state, actions }) {
  const [pending, setPending] = useState(null);
  return <div className="ds-settings">
    <form onSubmit={(event) => { event.preventDefault(); void actions.saveName(); }}>
      <label className="ds-field"><span className="ds-label">Name</span>
        <div className="ds-row">
          <input className="ds-input" type="text" maxLength={40} autoComplete="name" value={state.newName ?? state.profile.name ?? ""} onChange={(event) => actions.update({ newName: event.target.value })} />
          <button className="ds-btn" disabled={state.busy} type="submit">Save</button>
        </div>
      </label>
    </form>
    <div className="ds-field">
      <span className="ds-label ds-label-info">Username
        <span className="ds-info" tabIndex={0} role="img" aria-label="This is used for logging in" data-tip="This is used for logging in">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M8 7.25v4M8 4.75v.5" strokeLinecap="round" /></svg>
        </span>
      </span>
      <input className="ds-input" type="text" value={state.profile.username ?? ""} readOnly aria-readonly="true" />
    </div>
    {["profile"].map((kind) => <label className="ds-field" key={kind}>
      <span className="ds-label">{kind === "profile" ? "Profile" : "Background"} image · JPEG, PNG, or WebP · up to 5 MB</span>
      <input className="ds-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={state.busy} onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) setPending({ kind, file });
      }} />
    </label>)}
    {pending && <ImageCropper file={pending.file} onCancel={() => setPending(null)} onConfirm={(cropped) => { void actions.upload(pending.kind, cropped); setPending(null); }} />}
    <button className="ds-btn tertiary" onClick={actions.signOut} disabled={state.busy}>Sign out</button>
  </div>;
}
