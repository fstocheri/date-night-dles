import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GAMES, type GameInfo } from '../games/registry';
import { Layout } from '../shared/components/Layout';
import { localDate } from '../shared/data';
import { loadGame, loadStats } from '../shared/storage';
import '../shared/styles.css';

type Status =
  | { kind: 'new' }
  | { kind: 'playing'; guesses: number }
  | { kind: 'won'; guesses: number; hard: boolean }
  | { kind: 'lost' };

function statusOf(game: GameInfo): Status {
  const record = loadGame(game.id, localDate());
  if (record.outcome === 'won') return { kind: 'won', guesses: record.guesses.length, hard: record.hard };
  if (record.outcome === 'lost') return { kind: 'lost' };
  if (record.guesses.length) return { kind: 'playing', guesses: record.guesses.length };
  return { kind: 'new' };
}

function StatusPill({ status }: { status: Status }) {
  switch (status.kind) {
    case 'new':
      return <span className="pill pill--new">Not played yet</span>;
    case 'playing':
      return <span className="pill pill--playing">In progress · {status.guesses}/6</span>;
    case 'won':
      return <span className="pill pill--won">✓ Solved in {status.guesses}/6{status.hard ? '*' : ''}</span>;
    case 'lost':
      return <span className="pill pill--lost">✗ Missed it</span>;
  }
}

function Landing() {
  const [statuses, setStatuses] = useState(() => GAMES.map(statusOf));

  // Refresh when returning to this tab (e.g. after finishing a game in another tab).
  useEffect(() => {
    const refresh = () => setStatuses(GAMES.map(statusOf));
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  const finished = statuses.filter((s) => s.kind === 'won' || s.kind === 'lost').length;
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Layout title="Date Night Dles" emoji="🍿" tagline="A hand-picked lineup of daily puzzles, made for two.">
      <div className="lineup-head">
        <h2>Tonight's lineup</h2>
        <span className="muted">
          {today} · {finished} of {GAMES.length} played
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={finished} aria-valuemin={0} aria-valuemax={GAMES.length}>
        <span style={{ width: `${(finished / GAMES.length) * 100}%` }} />
      </div>

      <ul className="cards">
        {GAMES.map((game, i) => {
          const stats = loadStats(game.id);
          return (
            <li key={game.id}>
              <a className={`card card--${statuses[i].kind}`} href={`${import.meta.env.BASE_URL}${game.id}/`}>
                <span className="card__emoji" aria-hidden="true">
                  {game.emoji}
                </span>
                <span className="card__body">
                  <span className="card__category">{game.category}</span>
                  <strong className="card__title">{game.title}</strong>
                  <span className="muted">{game.tagline}</span>
                  {stats.streak > 1 && <span className="card__streak">🔥 {stats.streak}-day streak</span>}
                </span>
                <StatusPill status={statuses[i]} />
              </a>
            </li>
          );
        })}
      </ul>
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
