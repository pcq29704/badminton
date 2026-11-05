import { useId, useRef } from "react";
import { Button, Field, Notice } from "@/components/ui";

export default function PlayerSignIn({ state, actions }) {
  const passwordInput = useRef(null);
  const id = useId();
  return <form className="cb-form" onSubmit={(event) => { event.preventDefault(); void actions.login(); }}>
    <Field label="Username" htmlFor={`${id}-user`}>
      <input id={`${id}-user`} className="cb-input" type="text" autoComplete="username" value={state.loginUsername}
        onChange={(event) => actions.update({ loginUsername: event.target.value })}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); passwordInput.current?.focus(); } }} />
    </Field>
    <Field label="Password" htmlFor={`${id}-pass`}>
      <input id={`${id}-pass`} className="cb-input" ref={passwordInput} type="password" autoComplete="current-password" value={state.password}
        onChange={(event) => actions.update({ password: event.target.value })} />
    </Field>
    <Notice tone="error">{state.error}</Notice>
    <Button type="submit" disabled={state.busy}>{state.busy ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
