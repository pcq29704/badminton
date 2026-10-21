import AuthShell from "@/components/AuthShell";
import { Header } from "./Shared";

export default function AccessScreen({ state, actions }) {
  if (state.phase === "login") return <AuthShell current="organiser" eyebrow="Organiser" title="Run the courts." lead="Fair doubles rotations, balanced by Elo." cardTitle="Organiser sign in">
    <form onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
      <label className="ds-field"><span className="ds-label">Email</span>
        <input className="ds-input" type="email" placeholder="Email" autoComplete="username" value={state.loginEmail} onChange={(event) => actions.updateLoginEmail(event.target.value)} /></label>
      <label className="ds-field"><span className="ds-label">Password</span>
        <input className="ds-input" type="password" placeholder="Password" autoComplete="current-password" value={state.loginPassword} onChange={(event) => actions.updateLoginPassword(event.target.value)} /></label>
      <button className="ds-btn blue block" style={{ marginTop: 20 }} disabled={state.busy} type="submit">Sign in</button>
      <p className="ds-hint">Players can <a href="/">sign in on the player page</a>.</p>
    </form>
  </AuthShell>;

  if (state.phase === "not-organiser") {
    const email = state.user?.email || "your@email.com";
    return <><Header subtitle="Almost there" /><div className="card">
      <p style={{ marginTop: 0 }}>You're signed in as <b>{email}</b>, but this account isn't set as the organiser yet.</p>
      <p className="hint">In Supabase, open <b>SQL Editor</b>, run this once, then tap “Check again”:</p>
      <pre className="code">{`insert into public.organisers (user_id)\nselect id from auth.users where email = '${email.replaceAll("'", "''")}';`}</pre>
      <div className="row" style={{ marginTop: 12 }}><button className="btn" style={{ flex: 1 }} onClick={actions.retryLoad}>Check again</button><button className="btn ghost" onClick={actions.signOut}>Sign out</button></div>
    </div></>;
  }

  if (state.phase === "error") return <><Header subtitle="Something went wrong" /><div className="card">
    <p style={{ marginTop: 0 }}>Couldn't load your data:</p><p className="hint" style={{ color: "var(--danger)" }}>{state.errorMsg}</p>
    <p className="hint">Check your internet connection and that the development database is available.</p>
    <div className="row" style={{ marginTop: 12 }}><button className="btn" style={{ flex: 1 }} onClick={actions?.retryLoad}>Try again</button><button className="btn ghost" onClick={actions?.signOut}>Sign out</button></div>
  </div></>;

  return <><Header subtitle="Loading…" /><div className="card center"><p className="hint">Connecting to the database…</p></div></>;
}
