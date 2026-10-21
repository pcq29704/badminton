"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ConfigurationMessage from "@/components/ConfigurationMessage";
import { useCourtBalancer } from "./useCourtBalancer";
import { Header, Toast } from "./components/Shared";
import AccessScreen from "./components/AccessScreen";
import SetupScreen from "./components/SetupScreen";
import PlayScreen from "./components/PlayScreen";

export default function CourtBalancer() {
  const { state, actions: controls } = useCourtBalancer();
  const router = useRouter();
  const signedInHere = useRef(false);
  // An explicit organiser sign-in lands on the dashboard. A saved session still opens the court manager.
  const actions = controls && { ...controls, login: () => { signedInHere.current = true; return controls.login(); } };
  const ready = state.phase === "setup" || state.phase === "play";
  useEffect(() => { if (signedInHere.current && ready) router.replace("/dashboard"); }, [ready, router]);
  if (state.phase === "login") return <><AccessScreen state={state} actions={actions} /><Toast toast={state.toast} actions={actions} /></>;
  return <main className={`wrap${state.phase === "play" ? " wide" : ""}${state.busy ? " busy" : ""}`}>
    {state.phase === "configuration" ? <><Header subtitle="Court Balancer" /><ConfigurationMessage /></>
      : state.phase === "setup" ? <SetupScreen state={state} actions={actions} />
      : state.phase === "play" ? <PlayScreen state={state} actions={actions} />
      : <AccessScreen state={state} actions={actions} />}
    {state.busy && <div className="saving" role="status">Saving…</div>}
    <Toast toast={state.toast} actions={actions} />
  </main>;
}
