import { Header } from "./Shared";

export default function AccessScreen({ state, actions }) {
  if (state.phase === "login") return <>
    <Header subtitle="Fair doubles rotations, balanced by Elo · v8" />
    <form className="card" onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
      <div className="label" style={{ marginBottom: 6 }}>Organiser sign in</div>
      <input type="email" aria-label="Email" placeholder="Email" autoComplete="username" value={state.loginEmail} onChange={(event) => actions.updateLoginEmail(event.target.value)} />
      <input type="password" aria-label="Password" placeholder="Password" autoComplete="current-password" style={{ marginTop: 8 }} value={state.loginPassword} onChange={(event) => actions.updateLoginPassword(event.target.value)} />
      <button className="btn big" style={{ marginTop: 12 }} disabled={state.busy} type="submit">Sign in</button>
      <p className="hint">Only the organiser needs an account. Players don't sign in.</p>
    </form>
  </>;

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
