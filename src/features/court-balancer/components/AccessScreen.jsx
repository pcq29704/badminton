import AuthShell from "@/components/AuthShell";
import { Header } from "./Shared";

export default function AccessScreen({ state, actions, children }) {
  if (state.phase === "login") return <AuthShell current="organiser" eyebrow="Organiser" title="Run the courts." lead="Fair doubles rotations, balanced by Elo." cardTitle="Organiser sign in">
    <form onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
      <label className="ds-field"><span className="ds-label">Email</span>
        <input className="ds-input" type="email" placeholder="Email" autoComplete="username" value={state.loginEmail} onChange={(event) => actions.updateLoginEmail(event.target.value)} /></label>
      <label className="ds-field"><span className="ds-label">Password</span>
        <input className="ds-input" type="password" placeholder="Password" autoComplete="current-password" value={state.loginPassword} onChange={(event) => actions.updateLoginPassword(event.target.value)} /></label>
      <button className="ds-btn blue block" style={{ marginTop: 20 }} disabled={state.busy} type="submit">Sign in</button>
    </form>
    {children}
  </AuthShell>;

  if (state.phase === "not-organiser") {
    const email = state.user?.email || "your@email.com";
    return <><Header subtitle="Almost there" /><section className="ds-org-card">
      <p>You're signed in as <b>{email}</b>, but this account isn't set as the organiser yet.</p>
      <p className="ds-hint">In Supabase, open <b>SQL Editor</b>, run this once, then tap “Check again”:</p>
      <pre className="ds-org-code">{`insert into public.organisers (user_id)\nselect id from auth.users where email = '${email.replaceAll("'", "''")}';`}</pre>
      <div className="ds-org-form-row"><button className="ds-btn ds-org-grow" onClick={actions.retryLoad}>Check again</button><button className="ds-btn tertiary" onClick={actions.signOut}>Sign out</button></div>
    </section></>;
  }

  if (state.phase === "error") return <><Header subtitle="Something went wrong" /><section className="ds-org-card">
    <p>Couldn't load your data:</p><p className="ds-alert error">{state.errorMsg}</p>
    <p className="ds-hint">Check your internet connection and that the development database is available.</p>
    <div className="ds-org-form-row"><button className="ds-btn ds-org-grow" onClick={actions?.retryLoad}>Try again</button><button className="ds-btn tertiary" onClick={actions?.signOut}>Sign out</button></div>
  </section></>;

  return <><Header subtitle="Loading…" /><p className="ds-empty">Connecting to the database…</p></>;
}
