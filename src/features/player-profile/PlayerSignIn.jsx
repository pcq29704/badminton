import { useRef } from "react";

export default function PlayerSignIn({ state, actions }) {
  const passwordInput = useRef(null);
  return <form onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
    <label className="ds-field"><span className="ds-label">Username</span>
      <input className="ds-input" type="text" autoComplete="username" value={state.loginUsername} placeholder="Username"
        onChange={(event) => actions.update({ loginUsername: event.target.value })}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); passwordInput.current?.focus(); } }} />
    </label>
    <label className="ds-field"><span className="ds-label">Password</span>
      <input className="ds-input" ref={passwordInput} type="password" autoComplete="current-password" value={state.password} placeholder="Password"
        onChange={(event) => actions.update({ password: event.target.value })} />
    </label>
    {state.error && <p className="ds-alert error" role="alert">{state.error}</p>}
    <button className="ds-btn blue block" style={{ marginTop: 20 }} disabled={state.busy} type="submit">{state.busy ? "Signing in…" : "Sign in"}</button>
    <p className="ds-hint">The first password entered for an unclaimed username becomes its password.</p>
  </form>;
}
