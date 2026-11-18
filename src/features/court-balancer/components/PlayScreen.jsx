import { useEffect, useLayoutEffect, useRef } from "react";
import { playingIds } from "../matchmaking";
import { isDebug, playRuns, winStreaks, RUN_MIN } from "../helpers";
import { HelpPanel, MoreMenu, PanelSheet, PlayerTag, RunBadge, StreakBadge } from "./Shared";
import CourtCard from "./CourtCard";
import ManagePlayers from "./ManagePlayers";
import StatsPanel from "./StatsPanel";
import GameLog from "./GameLog";
import { ScoreSheet } from "./ScoreEntry";

function courtCols(n) {
  if (n <= 1) return 1;
  if (n <= 3) return n;
  let best = 3, bestEmpty = Infinity;
  for (const cols of [3, 2]) {
    const rem = n % cols;
    const empty = rem === 0 ? 0 : cols - rem;
    if (empty < bestEmpty) { best = cols; bestEmpty = empty; }
  }
  return best;
}

// Player chips: tap to cycle normal -> keen -> break
function StatusChips({ players, actions, streaks, runs }) {
  return <div className="cb-org-chips">{players.map((player) =>
    <button key={player.id} className={`cb-org-pchip${player.status === "break" ? " break" : player.status === "keen" ? " keen" : ""}`} onClick={() => actions.cycleStatus(player.id)}>
      <PlayerTag player={player} size="sm">
        {player.status === "break" && <span title="On break">☕</span>}{player.status === "keen" && <span title="Wants to play">⚡</span>}
        <StreakBadge count={streaks.get(player.id) || 0} /><RunBadge count={runs.get(player.id)} />
      </PlayerTag>
    </button>)}</div>;
}

// Keyboard path through the courts, the same on every court:
// Enter in the first box goes to the second; Enter in the second opens the result to confirm.
// Up and down go to the same box on the court above or below; left and right cross the dash.
function useScoreKeys(courtsRef, actions) {
  return function onKeyDown(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.score) return;
    const root = courtsRef.current;
    const box = (court, side) => root.querySelector(`input[data-court="${court}"][data-score="${side}"]`);
    const go = (el) => { if (!el) return; event.preventDefault(); el.focus(); el.select(); };
    const { court, score: side } = input.dataset;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
    const atEnd = input.selectionStart === input.value.length;
    if (event.key === "Enter") {
      event.preventDefault();
      if (side === "a") return go(box(court, "b"));
      if (!box(court, "a").value.trim()) return go(box(court, "a"));
      actions.reviewScore(Number(court));
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const same = [...root.querySelectorAll(`input[data-score="${side}"]`)];
      go(same[same.indexOf(input) + (event.key === "ArrowDown" ? 1 : -1)]);
    } else if (event.key === "ArrowRight" && side === "a" && atEnd) go(box(court, "b"));
    else if (event.key === "ArrowLeft" && side === "b" && atStart) go(box(court, "a"));
  };
}

// After the confirm sheet closes from the keyboard: a saved result moves on to the next court
// that still needs a score; Edit or Escape goes back to the second box of the same court.
// Touch users keep no focus, so the phone keyboard does not pop up by itself.
function useSheetFocus(state, courtsRef) {
  const keyboard = useRef(false);
  const open = useRef(null);
  useEffect(() => {
    const key = () => { keyboard.current = true; };
    const pointer = () => { keyboard.current = false; };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", pointer, true); };
  }, []);
  useEffect(() => {
    const sheet = state.scoreSheet;
    const was = open.current;
    if (sheet) { if (was?.gameId !== sheet.gameId) open.current = { ...sheet, logLength: state.log.length }; return; }
    open.current = null;
    if (!was || was.kind !== "finish" || !keyboard.current || !courtsRef.current) return;
    const root = courtsRef.current;
    if (state.log.length > was.logLength) {
      const firsts = [...root.querySelectorAll('input[data-score="a"]')];
      const from = firsts.findIndex((el) => Number(el.dataset.court) >= was.courtNo + 1);
      const order = from < 0 ? firsts : [...firsts.slice(from), ...firsts.slice(0, from)];
      const next = order.find((el) => !el.value) || order[0];
      next?.focus();
    } else root.querySelector(`input[data-court="${was.courtNo}"][data-score="b"]`)?.focus();
  }, [state.scoreSheet, state.log.length, courtsRef]);
}

// Courts take the roomiest density in which every court fits the space between the bar and the bench:
// roomy (head row), compact (court number rail holds Remix and End), dense (one line per court, no
// avatars). If dense still does not fit, only the court area scrolls. Decided by measuring, so it
// works for any number of courts and any screen. The density lives on a data attribute React does
// not render, and is set before paint.
const DENSITIES = ["roomy", "compact", "dense"];
function useCourtDensity(courtsRef, courts) {
  const shape = courts.map((c) => (c.game ? "g" : c.holdStartedAt ? "h" : "i") + (c.closing ? "x" : "")).join("");
  useLayoutEffect(() => {
    const el = courtsRef.current;
    if (!el) return;
    const fit = () => {
      for (const density of DENSITIES) {
        el.dataset.density = density;
        if (el.scrollHeight <= el.clientHeight + 1) return;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [courtsRef, shape]);
}

export default function PlayScreen({ state, actions }) {
  const courtsRef = useRef(null);
  useCourtDensity(courtsRef, state.courts);
  const onScoreKey = useScoreKeys(courtsRef, actions);
  useSheetFocus(state, courtsRef);
  const busy = playingIds(state);
  const bench = state.players.filter((p) => !busy.has(p.id))
    .sort((a, b) => (a.status === "break") - (b.status === "break"));
  const resting = bench.filter((p) => p.status === "break").length;
  const runs = playRuns(state.players, busy);
  const debug = isDebug();
  const streaks = winStreaks(state.log);
  const games = state.log.length;
  return <>
    <div className="cb-org-bar">
      <p className="cb-org-tally"><span className="cb-org-count">{games}</span> {games === 1 ? "game" : "games"} done</p>
      <div className="cb-org-actions">
        {/* Unranked toggle hidden for now: new matches are always ranked.
            <button className={`cb-btn quiet cb-org-rank${state.session.rank_new_games ? " on" : ""}`} onClick={actions.toggleRanked} aria-pressed={state.session.rank_new_games}>{state.session.rank_new_games ? "Ranked" : "Unranked"} for new matches</button> */}
        <button className="cb-btn quiet mini" onClick={actions.reshuffleAll}>Remix all</button>
        <button className="cb-btn quiet mini" onClick={actions.toggleManage}>Players</button>
        <MoreMenu items={[
          { label: "Add court", onClick: actions.addCourt },
          { label: "How to use", onClick: actions.toggleHelp },
          debug && { label: "Stats", onClick: actions.toggleStats },
          debug && { label: "Log", onClick: actions.toggleLog },
          { label: "End play day", onClick: actions.endDay, danger: true },
          { label: "Sign out", onClick: actions.signOut },
        ]} />
      </div>
    </div>
    <p className="cb-org-keys" aria-hidden="true"><kbd>Enter</kbd> next box, then finish · <kbd>↑</kbd><kbd>↓</kbd> other court · <kbd>Esc</kbd> back</p>
    <ScoreSheet state={state} actions={actions} />
    <div className="cb-org-courts" ref={courtsRef} onKeyDown={onScoreKey} style={{ gridTemplateColumns: `repeat(${courtCols(state.courts.length)}, minmax(0, 1fr))` }}>
      {state.courts.map((court) => <CourtCard key={court.id} court={court} state={state} actions={actions} runs={runs} streaks={streaks} />)}
    </div>
    <section className="cb-org-bench" aria-labelledby="cb-bench-title">
      <div className="cb-org-bench-head">
        <h2 id="cb-bench-title" className="cb-label">Bench · {bench.length - resting} waiting{resting > 0 && ` · ${resting} on break`}</h2>
        {bench.length > 0 && <span className="cb-org-note">Tap to change status</span>}
      </div>
      {bench.length ? <StatusChips players={bench} actions={actions} streaks={streaks} runs={runs} /> : <p className="cb-note">Everyone is on court.</p>}
    </section>
    {state.showHelp && <PanelSheet label="How to use" onClose={actions.toggleHelp}><HelpPanel state={state} actions={actions} /></PanelSheet>}
    {state.showManage && <PanelSheet label="Players" onClose={actions.toggleManage}>
      <section className="cb-org-group"><h2 className="cb-org-label">Player status — tap to cycle</h2>
        <StatusChips players={state.players} actions={actions} streaks={streaks} runs={runs} />
        <div className="cb-org-legend"><span>plain = normal</span><span className="keen">⚡ = wants to play (priority)</span><span className="rest">☕ = on break</span><span>💃{RUN_MIN} = {RUN_MIN} games in a row</span><span>⭐ 3 · 🔥 4 · 👑 5+ wins in a row</span></div>
        <p className="cb-note">Status changes apply when a court picks its next game. To redo a game that hasn&apos;t started, use Remix.</p>
      </section>
      <ManagePlayers state={state} actions={actions} />
    </PanelSheet>}
    {debug && state.showStats && <PanelSheet label="Stats" onClose={actions.toggleStats}><StatsPanel state={state} /></PanelSheet>}
    {debug && state.showLog && <PanelSheet label="Match history" onClose={actions.toggleLog}><GameLog state={state} actions={actions} /></PanelSheet>}
  </>;
}
