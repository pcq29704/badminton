import AuthShell from "@/components/AuthShell";
import { Button, Card, Field, Notice } from "@/components/ui";
import { Header } from "./Shared";

export default function AccessScreen({ state, actions, children }) {
  if (state.phase === "login") return <AuthShell current="organiser" title="Run the courts." lead="Fair doubles rotations, balanced by Elo." cardTitle="Organiser sign in">
    <form className="cb-form" onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
      <Field label="Email" htmlFor="org-email">
        <input id="org-email" className="cb-input" type="email" autoComplete="username" value={state.loginEmail} onChange={(event) => actions.updateLoginEmail(event.target.value)} />
      </Field>
      <Field label="Password" htmlFor="org-pass">
        <input id="org-pass" className="cb-input" type="password" autoComplete="current-password" value={state.loginPassword} onChange={(event) => actions.updateLoginPassword(event.target.value)} />
      </Field>
      <Button type="submit" disabled={state.busy}>Sign in</Button>
    </form>
    {children}
  </AuthShell>;

  if (state.phase === "not-organiser") {
    const email = state.user?.email || "your@email.com";
    return <><Header subtitle="Almost there" /><Card title="Account not set up" className="cb-org-card">
      <p>You're signed in as <b>{email}</b>, but this account isn't set as the organiser yet.</p>
      <p className="cb-note">In Supabase, open <b>SQL Editor</b>, run this once, then tap “Check again”:</p>
      <pre className="cb-org-code">{`insert into public.organisers (user_id)\nselect id from auth.users where email = '${email.replaceAll("'", "''")}';`}</pre>
      <div className="cb-org-actions"><button className="cb-btn" onClick={actions.retryLoad}>Check again</button><button className="cb-btn quiet" onClick={actions.signOut}>Sign out</button></div>
    </Card></>;
  }

  if (state.phase === "error") return <><Header subtitle="Something went wrong" /><Card title="Couldn't load your data" className="cb-org-card">
    <Notice tone="error">{state.errorMsg}</Notice>
    <p className="cb-note">Check your internet connection and that the development database is available.</p>
    <div className="cb-org-actions"><button className="cb-btn" onClick={actions?.retryLoad}>Try again</button><button className="cb-btn quiet" onClick={actions?.signOut}>Sign out</button></div>
  </Card></>;

  return <><Header subtitle="Loading…" /><p className="cb-empty" role="status">Connecting to the database…</p></>;
}
