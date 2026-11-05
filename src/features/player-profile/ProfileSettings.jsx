import { useState } from "react";
import { Button, Card, Field } from "@/components/ui";
import ImageCropper from "./ImageCropper";

// Settings tab, only for the signed-in owner. `notices` shows save results inside the card, next to the fields.
export default function ProfileSettings({ state, actions, notices }) {
  const [pending, setPending] = useState(null);
  return <Card title="Edit profile">
    <div className="cb-form">
      {notices}
      <form onSubmit={(event) => { event.preventDefault(); void actions.saveName(); }}>
        <Field label="Name" htmlFor="profile-name">
          <div className="cb-field-row">
            <input className="cb-input" id="profile-name" type="text" maxLength={40} autoComplete="name" value={state.newName ?? state.profile.name ?? ""} onChange={(event) => actions.update({ newName: event.target.value })} disabled={state.busy} />
            <Button type="submit" disabled={state.busy}>Save name</Button>
          </div>
        </Field>
      </form>
      <Field label="Username" htmlFor="profile-username" hint="You sign in with this. It cannot be changed here.">
        <input className="cb-input" id="profile-username" type="text" value={state.profile.username ?? ""} readOnly aria-describedby="profile-username-hint" />
      </Field>
      <Field label="Profile picture" htmlFor="profile-photo" hint="JPEG, PNG or WebP, up to 5 MB. You can crop it next.">
        <div className="cb-file-row">
          <label className="cb-btn quiet" htmlFor="profile-photo" aria-disabled={state.busy || undefined}>Choose picture</label>
          <input className="cb-file-input" id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="profile-photo-hint" disabled={state.busy} onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) setPending({ kind: "profile", file });
          }} />
        </div>
      </Field>
      <div className="cb-sep" />
      <div><Button variant="quiet" onClick={actions.signOut} disabled={state.busy}>Sign out</Button></div>
    </div>
    {pending && <ImageCropper file={pending.file} onCancel={() => setPending(null)} onConfirm={(cropped) => { void actions.upload(pending.kind, cropped); setPending(null); }} />}
  </Card>;
}
