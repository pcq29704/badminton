"use client";

import ConfigurationMessage from "@/components/ConfigurationMessage";
import { useCourtBalancer } from "./useCourtBalancer";
import { Header, Toast } from "./components/Shared";
import AccessScreen from "./components/AccessScreen";
import SetupScreen from "./components/SetupScreen";
import PlayScreen from "./components/PlayScreen";

export default function CourtBalancer() {
  const { state, actions } = useCourtBalancer();
  return <main className={`wrap${state.phase === "play" ? " wide" : ""}${state.busy ? " busy" : ""}`}>
    {state.phase === "configuration" ? <><Header subtitle="Court Balancer" /><ConfigurationMessage /></>
      : state.phase === "setup" ? <SetupScreen state={state} actions={actions} />
      : state.phase === "play" ? <PlayScreen state={state} actions={actions} />
      : <AccessScreen state={state} actions={actions} />}
    {state.busy && <div className="saving" role="status">Saving…</div>}
    <Toast toast={state.toast} actions={actions} />
  </main>;
}
