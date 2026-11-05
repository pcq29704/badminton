"use client";

import ConfigurationMessage from "@/components/ConfigurationMessage";
import { TopNav } from "@/components/AuthShell";
import { useCourtBalancer } from "./useCourtBalancer";
import { Header, Toast } from "./components/Shared";
import AccessScreen from "./components/AccessScreen";
import SetupScreen from "./components/SetupScreen";
import PlayScreen from "./components/PlayScreen";

const ORGANISER = { role: "organiser", username: "" };

export default function CourtBalancer() {
  const { state, actions } = useCourtBalancer();
  const toast = <Toast toast={state.toast} actions={actions} />;
  // After an organiser signs in, the game setup screen (or the active game) shows on this page.
  if (state.phase === "login") return <AccessScreen state={state} actions={actions}>{toast}</AccessScreen>;
  const signedIn = state.phase === "setup" || state.phase === "play";
  return <div className="ds-root">
    <TopNav current="courts" viewer={signedIn ? ORGANISER : undefined} onSignOut={actions?.signOut} />
    <main className={`cb-page cb-org${state.phase === "play" ? " wide" : ""}${state.busy ? " busy" : ""}`}>
      {state.phase === "configuration" ? <><Header subtitle="Court Balancer" /><ConfigurationMessage /></>
        : state.phase === "setup" ? <SetupScreen state={state} actions={actions} />
        : state.phase === "play" ? <PlayScreen state={state} actions={actions} />
        : <AccessScreen state={state} actions={actions} />}
      {state.busy && <div className="cb-org-saving" role="status">Saving…</div>}
      {toast}
    </main>
  </div>;
}
