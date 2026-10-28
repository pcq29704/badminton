import { isDebug } from "../helpers";
import { Header, HelpPanel, PlayerForm, PlayerTag, isNewPlayer } from "./Shared";

export default function SetupScreen({ state, actions }) {
  return <>
    <Header subtitle="Fair doubles rotations, balanced by Elo · v8" />
    <div className="ds-org-actions center">
      <button className="ds-btn tertiary" onClick={actions.toggleHelp}>? How to use / Hướng dẫn</button><button className="ds-btn tertiary" onClick={actions.signOut}>Sign out</button>
    </div>
    {state.showHelp && <HelpPanel state={state} actions={actions} />}
    <div className="ds-org-stepper">
      <div className="ds-org-label">Courts</div><div className="ds-org-stepper-controls">
        <button className="ds-btn tertiary" aria-label="One court less" onClick={() => actions.bumpCourts(-1)}>−</button><span className="ds-org-stepper-val">{state.setupCourts}</span><button className="ds-btn tertiary" aria-label="One court more" onClick={() => actions.bumpCourts(1)}>+</button>
      </div>
    </div>
    <section className="ds-org-card">
      <div className="ds-org-card-head"><h2 className="ds-org-label">Who's here today ({state.picked.size})</h2><div className="ds-org-actions"><button className="ds-btn tertiary ds-org-mini" onClick={actions.pickAll}>All</button><button className="ds-btn tertiary ds-org-mini" onClick={actions.pickNone}>None</button></div></div>
      {!state.roster.length ? <p className="ds-hint">No players yet — add your group below. You only do this once.</p>
        : <div className="ds-org-chips">{state.roster.map((player) => {
          const isNew = isNewPlayer(player, state.settings);
          const note = isDebug() ? `${Math.round(player.elo)}${isNew ? " · new" : ""}` : isNew ? "new" : "";
          return <button key={player.id} className={`ds-org-pchip pick${state.picked.has(player.id) ? " on" : ""}`} aria-pressed={state.picked.has(player.id)} onClick={() => actions.togglePick(player.id)}>
            <PlayerTag player={player} size="sm">{note && <span className="ds-org-note">{note}</span>}</PlayerTag>
            <span className="ds-org-check" aria-hidden="true">✓</span>
          </button>;
        })}</div>}
    </section>
    <section className="ds-org-card"><h2 className="ds-org-label">Add a new player</h2><PlayerForm state={state} actions={actions} /></section>
    <div className="ds-org-start">
      <button className="ds-btn blue block" onClick={actions.startDay} disabled={state.busy || state.picked.size < 4}>Start play day →</button>
      {state.picked.size < 4 ? <p className="ds-org-warn">Tick at least 4 players.</p> : state.picked.size < state.setupCourts * 4 && <p className="ds-org-warn">Heads up: {state.picked.size} players can fill {Math.floor(state.picked.size / 4)} court(s) at a time.</p>}
    </div>
  </>;
}
