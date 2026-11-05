import { Fragment } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { HELP } from "../help";
import { STREAK_MIN, isDebug, signed, streakIcon } from "../helpers";

export function Header({ subtitle }) {
  return <header className="cb-auth-head">
    <h1 className="cb-auth-title">Court Balancer</h1>
    <p className="cb-note">{subtitle}</p>
  </header>;
}

// Name, photo, and frame for one player. Log entries and court slots only carry an id, so the
// roster gives the photo and tier.
export function playerInfo(state, id, fallback = {}) {
  const here = state.players.find((p) => p.id === id);
  const listed = state.roster.find((p) => p.id === id);
  return { id, name: state.names.get(id) || "?", status: "normal", ...listed, ...fallback, ...here };
}

// A player shown with their profile picture inside the tier frame. `children` adds badges after the name.
export function PlayerTag({ player, size = "md", children }) {
  return <span className={`cb-org-player ${size}`} data-tier={String(player.tier || "").toUpperCase() || undefined}>
    <PlayerAvatar className="cb-org-avatar" path={player.profile_image_path} tier={player.tier} name={player.name} />
    <span className="cb-org-name">{player.name}</span>
    {children}
  </span>;
}

export function StreakBadge({ count }) {
  return count >= STREAK_MIN ? <span className="cb-org-streak-badge" title={`${count} wins in a row`}>{streakIcon(count)}{count}</span> : null;
}

export function Delta({ value }) {
  return <span className={`cb-org-delta ${value >= 0 ? "up" : "down"}`}>{signed(value)}</span>;
}

export function isNewPlayer(player, settings) {
  return (player.gamesTotal ?? player.games_total ?? 0) < (settings?.provisional_games ?? 10);
}

export function HelpPanel({ state, actions }) {
  const help = HELP[state.helpLang];
  return <section className="cb-org-group">
    <div className="cb-org-head"><h2 className="cb-org-label">{help.title}</h2>
      <div className="cb-chips">{["en", "vi"].map((language) =>
        <button key={language} className="cb-chip" aria-pressed={state.helpLang === language} onClick={() => actions.setHelpLang(language)}>{language.toUpperCase()}</button>)}</div>
    </div>
    {help.sections.map(([heading, items]) => <div className="cb-org-help-sec" key={heading}>
      <h3 className="cb-org-help-h">{heading}</h3><ul className="cb-org-help-ul">{items.map((item) =>
        <li key={item}>{item.split(/(<b>.*?<\/b>)/g).map((part, index) => part.startsWith("<b>")
          ? <b key={index}>{part.slice(3, -4)}</b> : <Fragment key={index}>{part}</Fragment>)}</li>)}</ul>
    </div>)}
    <button className="cb-btn quiet" onClick={actions.toggleHelp}>Close</button>
  </section>;
}

export function Toast({ toast, actions }) {
  if (!toast) return null;
  const entry = toast.result;
  const winners = entry && (entry.winner === "A" ? entry.teamA : entry.teamB);
  return <div className={`cb-org-toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
    <button className="cb-org-toast-x" onClick={actions.hideToast} aria-label="Close">×</button>
    {entry ? <>
      <div className="cb-org-toast-title">{toast.corrected ? "Corrected — " : ""}Court {entry.courtNo} ({entry.ranked ? "Ranked" : "Unranked"}): {winners.map((p) => p.name).join(" & ")} won</div>
      {isDebug() && <div className="cb-org-toast-body">{entry.ranked ? [...entry.teamA, ...entry.teamB].map((p, index) =>
        <Fragment key={p.id}>{index > 0 && " · "}{p.name} <Delta value={p.after - p.before} /></Fragment>) : "Unranked — ratings unchanged"}</div>}
      {toast.shouts?.length > 0 && <div className="cb-org-toast-body cb-org-shout">{toast.shouts.map((shout, index) =>
        <Fragment key={index}>{index > 0 && <br />}{shout.icon} <b>{shout.name}</b>{shout.text}</Fragment>)}</div>}
    </> : <div className="cb-org-pre">{toast.message}</div>}
    {toast.gameId && <button className="cb-btn quiet mini" onClick={() => actions.correctResult(toast.gameId)}>Wrong side? Flip result</button>}
  </div>;
}

export function PlayerForm({ state, actions, duringPlay = false }) {
  const tiers = state.tiers.filter((tier) => tier.seed_elo != null);
  const add = duringPlay ? actions.addNewPlayerDuringPlay : actions.addNewPlayerAtSetup;
  return <form onSubmit={(event) => { event.preventDefault(); add(); }}>
    <div className="cb-org-form-row">
      <input className="cb-input" type="text" aria-label="Player name" value={state.newName} placeholder={duringPlay ? "New player name" : "Name"} onChange={(event) => actions.updateNewName(event.target.value)} />
      <input className="cb-input" type="text" aria-label="Player username" value={state.newUsername} placeholder="Username" maxLength={32} onChange={(event) => actions.updateNewUsername(event.target.value)} />
    </div>
    <div className="cb-org-form-row">
      <select className="cb-input" aria-label="Starting tier" value={state.newTier} onChange={(event) => actions.updateNewTier(event.target.value)}>
        {tiers.map((tier) => <option key={tier.code} value={tier.code}>Tier {tier.code}</option>)}
      </select>
      <button className="cb-btn quiet" type="submit" disabled={state.busy}>{duringPlay ? "Add new" : "Add"}</button>
    </div>
    {!duringPlay && <p className="cb-note">{tiers.map((tier, index) =>
      <Fragment key={tier.code}>{index > 0 && " · "}<b>{tier.code}</b> starts at {tier.seed_elo}</Fragment>)}. Pick once — after that the rating updates itself.</p>}
  </form>;
}
