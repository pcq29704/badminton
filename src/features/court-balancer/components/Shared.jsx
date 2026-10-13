import { Fragment } from "react";
import { HELP } from "../help";
import { profileHref, signed } from "../helpers";

export function Header({ subtitle }) {
  return <header id="app-header"><div style={{ fontSize: 46 }}>🏸</div><h1>Court Balancer</h1><p className="sub">{subtitle}</p></header>;
}

export function ProfileName({ player }) {
  return player.username
    ? <a className="player-profile-name" href={profileHref(player.username)}>{player.name}</a>
    : player.name;
}

export function TierBadge({ code }) {
  return code ? <span className={`tier t-${code}`}>{code}</span> : null;
}

export function Delta({ value }) {
  return <span className={`delta ${value >= 0 ? "up" : "down"}`}>{signed(value)}</span>;
}

export function isNewPlayer(player, settings) {
  return (player.gamesTotal ?? player.games_total ?? 0) < (settings?.provisional_games ?? 10);
}

export function HelpPanel({ state, actions }) {
  const help = HELP[state.helpLang];
  return <div className="card">
    <div className="card-head"><div className="label">{help.title}</div>
      <div style={{ display: "flex", gap: 6 }}>{["en", "vi"].map((language) =>
        <button key={language} className={`mini-btn${state.helpLang === language ? " on" : ""}`} onClick={() => actions.setHelpLang(language)}>{language.toUpperCase()}</button>)}</div>
    </div>
    {help.sections.map(([heading, items]) => <div className="help-sec" key={heading}>
      <div className="help-h">{heading}</div><ul className="help-ul">{items.map((item) =>
        <li key={item}>{item.split(/(<b>.*?<\/b>)/g).map((part, index) => part.startsWith("<b>")
          ? <b key={index}>{part.slice(3, -4)}</b> : <Fragment key={index}>{part}</Fragment>)}</li>)}</ul>
    </div>)}
    <button className="btn subtle" style={{ width: "100%", marginTop: 6 }} onClick={actions.toggleHelp}>Close</button>
  </div>;
}

export function Toast({ toast, actions }) {
  if (!toast) return null;
  const entry = toast.result;
  const winners = entry && (entry.winner === "A" ? entry.teamA : entry.teamB);
  return <div className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
    <button className="toast-x" onClick={actions.hideToast} aria-label="Close">✕</button>
    {entry ? <>
      <div className="toast-title">{toast.corrected ? "Corrected — " : ""}Court {entry.courtNo} ({entry.ranked ? "Ranked" : "Unranked"}): {winners.map((p) => p.name).join(" & ")} won</div>
      <div className="toast-body">{entry.ranked ? [...entry.teamA, ...entry.teamB].map((p, index) =>
        <Fragment key={p.id}>{index > 0 && " · "}{p.name} <Delta value={p.after - p.before} /></Fragment>) : "Unranked — ratings unchanged"}</div>
    </> : <div style={{ whiteSpace: "pre-line" }}>{toast.message}</div>}
    {toast.gameId && <button className="mini-btn" style={{ marginTop: 8 }} onClick={() => actions.correctResult(toast.gameId)}>⇄ Wrong side? Flip result</button>}
  </div>;
}

export function PlayerForm({ state, actions, duringPlay = false }) {
  const tiers = state.tiers.filter((tier) => tier.seed_elo != null);
  const add = duringPlay ? actions.addNewPlayerDuringPlay : actions.addNewPlayerAtSetup;
  return <form onSubmit={(event) => { event.preventDefault(); add(); }}>
    <div className="player-row">
      <input type="text" aria-label="Player name" value={state.newName} placeholder={duringPlay ? "New player name" : "Name"} onChange={(event) => actions.updateNewName(event.target.value)} />
      <input type="text" aria-label="Player username" value={state.newUsername} placeholder="Username" maxLength={32} onChange={(event) => actions.updateNewUsername(event.target.value)} />
    </div>
    <div className="player-row">
      <select aria-label="Starting tier" value={state.newTier} onChange={(event) => actions.updateNewTier(event.target.value)}>
        {tiers.map((tier) => <option key={tier.code} value={tier.code}>Tier {tier.code}</option>)}
      </select>
      <button className="btn subtle" type="submit" disabled={state.busy}>{duringPlay ? "+ New" : "+ Add"}</button>
    </div>
    {!duringPlay && <p className="hint" style={{ marginTop: 0 }}>{tiers.map((tier, index) =>
      <Fragment key={tier.code}>{index > 0 && " · "}<b>{tier.code}</b> starts at {tier.seed_elo}</Fragment>)}. Pick once — after that the rating updates itself.</p>}
  </form>;
}
