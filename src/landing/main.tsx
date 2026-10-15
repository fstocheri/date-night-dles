import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GAMES, type GameInfo } from '../games/registry';
import { Layout } from '../shared/components/Layout';
import { localDate } from '../shared/data';
import { loadGame, loadStats } from '../shared/storage';
import { CustomLinks } from './CustomLinks';
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

/** Corner badge icon + short label for a tile. */
function describe(status: Status): { icon: string; label: string } {
  switch (status.kind) {
    case 'new':
      return { icon: '', label: 'Not played' };
    case 'playing':
      return { icon: '…', label: `In progress · ${status.guesses}/6` };
    case 'won':
      return { icon: '✓', label: `Solved ${status.guesses}/6${status.hard ? '*' : ''}` };
    case 'lost':
      return { icon: '✗', label: 'Missed it' };
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

      <ul className="tiles">
        {GAMES.map((game, i) => {
          const status = statuses[i];
          const { icon, label } = describe(status);
          const streak = loadStats(game.id).streak;
          return (
            <li key={game.id}>
              <a
                className={`tile tile--${status.kind}`}
                href={`${import.meta.env.BASE_URL}${game.id}/`}
                title={game.tagline}
                aria-label={`${game.title}: ${game.tagline} ${label}.`}
              >
                <span className="tile__badge" aria-hidden="true">
                  {icon}
                </span>
                {streak > 1 && <span className="tile__streak">🔥{streak}</span>}
                <span className="tile__icon" aria-hidden="true">
                  {game.emoji}
                </span>
                <strong className="tile__title">{game.title}</strong>
                <span className="tile__category">{game.category}</span>
                <span className="tile__status">{label}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <CustomLinks />
    </Layout>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
