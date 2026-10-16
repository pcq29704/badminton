import { Fragment } from "react";
import { isDebug, profileHref } from "../helpers";
import { Header, HelpPanel, PlayerForm, TierBadge, isNewPlayer } from "./Shared";

export default function SetupScreen({ state, actions }) {
  return <>
    <Header subtitle="Fair doubles rotations, balanced by Elo · v8" />
    <div className="center" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      <button className="mini-btn" onClick={actions.toggleHelp}>? How to use / Hướng dẫn</button><button className="mini-btn" onClick={actions.signOut}>Sign out</button>
    </div>
    {state.showHelp && <HelpPanel state={state} actions={actions} />}
    <div className="row" style={{ marginTop: 18 }}><div className="stepper">
      <div className="label">Courts</div><div className="controls">
        <button className="btn subtle" onClick={() => actions.bumpCourts(-1)}>−</button><span className="val">{state.setupCourts}</span><button className="btn subtle" onClick={() => actions.bumpCourts(1)}>+</button>
      </div>
    </div></div>
    <div className="card">
      <div className="card-head"><div className="label">Who's here today ({state.picked.size})</div><div style={{ display: "flex", gap: 6 }}><button className="mini-btn" onClick={actions.pickAll}>All</button><button className="mini-btn" onClick={actions.pickNone}>None</button></div></div>
      {!state.roster.length ? <p className="hint" style={{ margin: 0 }}>No players yet — add your group below. You only do this once.</p>
        : <div className="chips">{state.roster.map((player) => <Fragment key={player.id}>
          <button className={`chip pick${state.picked.has(player.id) ? " on" : ""}`} onClick={() => actions.togglePick(player.id)}>
            {state.picked.has(player.id) ? "✓ " : ""}{player.name} <TierBadge code={player.tier} /><span className="elo">{isDebug() ? `${Math.round(player.elo)}${isNewPlayer(player, state.settings) ? " · new" : ""}` : isNewPlayer(player, state.settings) ? "new" : ""}</span>
          </button>
          {player.username && <a className="mini-btn profile-link" href={profileHref(player.username)} aria-label={`Profile for ${player.username}`} title="Player profile">↗</a>}
        </Fragment>)}</div>}
    </div>
    <div className="card"><div className="label" style={{ marginBottom: 8 }}>Add a new player</div><PlayerForm state={state} actions={actions} /></div>
    <div className="center" style={{ marginTop: 16, paddingBottom: 30 }}>
      <button className="btn big" onClick={actions.startDay} disabled={state.busy || state.picked.size < 4}>Start play day →</button>
      {state.picked.size < 4 ? <p className="warn">Tick at least 4 players.</p> : state.picked.size < state.setupCourts * 4 && <p className="warn">Heads up: {state.picked.size} players can fill {Math.floor(state.picked.size / 4)} court(s) at a time.</p>}
    </div>
  </>;
}
