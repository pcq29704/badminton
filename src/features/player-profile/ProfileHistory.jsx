"use client";

import { useState } from "react";
import LocalDate from "@/components/LocalDate";
import { Card, MatchRow, resultFor } from "@/components/ui";

const FILTERS = [["all", "All"], ["won", "Won"], ["lost", "Lost"]];

// Match history tab: every finished game from this player's side, with an All / Won / Lost filter.
export default function ProfileHistory({ games, username }) {
  const [filter, setFilter] = useState("all");
  const shown = filter === "all" ? games : games.filter((game) => resultFor(game, username) === filter);
  const tools = games.length > 0 && <div role="group" aria-label="Show games" className="cb-chips">
    {FILTERS.map(([id, label]) => <button key={id} type="button" className="cb-chip" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
  </div>;
  return <Card title="Match history" note={games.length ? `${games.length} finished ${games.length === 1 ? "game" : "games"}` : undefined} tools={tools}>
    {!games.length && <p className="cb-empty">No finished games yet.</p>}
    {games.length > 0 && !shown.length && <p className="cb-empty">No games match this filter.</p>}
    {shown.length > 0 && <ol className="cb-matches">{shown.map((game, index) => <MatchRow
      key={`${game.ended_at}-${index}`}
      game={game}
      focus={username}
      when={game.ended_at ? <LocalDate value={game.ended_at} options={{ dateStyle: "medium", timeStyle: "short" }} /> : "Date unavailable"}
    />)}</ol>}
  </Card>;
}
