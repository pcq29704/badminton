import { isDebug } from "../helpers";
import { Header, HelpPanel, PlayerForm, PlayerTag, isNewPlayer } from "./Shared";

export default function SetupScreen({ state, actions }) {
  return <>
    <Header subtitle="Fair doubles rotations, balanced by Elo · v8" />
    <div className="cb-org-actions center">
      <button className="cb-btn quiet" onClick={actions.toggleHelp}>How to use / Hướng dẫn</button><button className="cb-btn quiet" onClick={actions.signOut}>Sign out</button>
    </div>
    {state.showHelp && <HelpPanel state={state} actions={actions} />}
    <div className="cb-org-stepper">
      <div className="cb-org-label">Courts</div><div className="cb-org-stepper-controls">
        <button className="cb-btn quiet" aria-label="One court less" onClick={() => actions.bumpCourts(-1)}>−</button><span className="cb-org-stepper-val">{state.setupCourts}</span><button className="cb-btn quiet" aria-label="One court more" onClick={() => actions.bumpCourts(1)}>+</button>
      </div>
    </div>
    <section className="cb-org-group">
      <div className="cb-org-head"><h2 className="cb-org-label">Who's here today ({state.picked.size})</h2><div className="cb-org-actions"><button className="cb-btn quiet mini" onClick={actions.pickAll}>All</button><button className="cb-btn quiet mini" onClick={actions.pickNone}>None</button></div></div>
      {!state.roster.length ? <p className="cb-note">No players yet — add your group below. You only do this once.</p>
        : <div className="cb-org-chips">{state.roster.map((player) => {
          const isNew = isNewPlayer(player, state.settings);
          const note = isDebug() ? `${Math.round(player.elo)}${isNew ? " · new" : ""}` : isNew ? "new" : "";
          return <button key={player.id} className={`cb-org-pchip pick${state.picked.has(player.id) ? " on" : ""}`} aria-pressed={state.picked.has(player.id)} onClick={() => actions.togglePick(player.id)}>
            <PlayerTag player={player} size="sm">{note && <span className="cb-org-note">{note}</span>}</PlayerTag>
            <span className="cb-org-check" aria-hidden="true">✓</span>
          </button>;
        })}</div>}
    </section>
    <section className="cb-org-group"><h2 className="cb-org-label">Add a new player</h2><PlayerForm state={state} actions={actions} /></section>
    <div className="cb-org-start">
      <button className="cb-btn block" onClick={actions.startDay} disabled={state.busy || state.picked.size < 4}>Start play day</button>
      {state.picked.size < 4 ? <p className="cb-org-warn">Tick at least 4 players.</p> : state.picked.size < state.setupCourts * 4 && <p className="cb-org-warn">Heads up: {state.picked.size} players can fill {Math.floor(state.picked.size / 4)} court(s) at a time.</p>}
    </div>
  </>;
}
