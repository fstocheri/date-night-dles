import { useEffect, useMemo, useState } from 'react';
import { GuessInput } from './components/GuessInput';
import { GuessRow } from './components/GuessRow';
import { Result } from './components/Result';
import { MAX_SEASON_GUESSES, SeasonBonus } from './components/SeasonBonus';
import { findAnswer, findSeason, loadCatalog, loadPuzzle, localDate, stillUrl } from './lib/data';
import { loadGame, loadStats, recordResult, saveGame, saveHardPref, type GameRecord, type Stats } from './lib/storage';
import type { Guess, Puzzle, Show } from './lib/types';

const MAX_GUESSES = 6;
const BLUR_PX = [28, 18, 11, 6, 3, 1]; // by number of wrong guesses

type Loaded = { puzzle: Puzzle; shows: Show[]; answer: Show; season: number | null };
type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Loaded };

export default function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      const [catalog, puzzle] = await Promise.all([loadCatalog(), loadPuzzle(localDate())]);
      if (!puzzle) throw new Error("Today's episode hasn't aired yet. Check back soon.");
      const answer = await findAnswer(puzzle, catalog.shows);
      if (!answer) throw new Error("Today's puzzle is broken. We're looking into it.");
      const season = await findSeason(puzzle, answer);
      setLoad({ status: 'ready', data: { puzzle, shows: catalog.shows, answer, season } });
    })().catch((err: Error) => setLoad({ status: 'error', message: err.message }));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span aria-hidden="true">📺</span> Channel Surf
        </h1>
        <p className="muted">Name the TV show from a single episode.</p>
      </header>

      <main>
        {load.status === 'loading' && <p className="status">Tuning in…</p>}
        {load.status === 'error' && <p className="status">{load.message}</p>}
        {load.status === 'ready' && <Game {...load.data} />}
      </main>

      <footer className="footer">
        <p>
          Show data and images from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </div>
  );
}

function Game({ puzzle, shows, answer, season }: Loaded) {
  const byId = useMemo(() => new Map(shows.map((s) => [s.id, s])), [shows]);
  const [game, setGame] = useState<GameRecord>(() => loadGame(puzzle.date));
  const [stats, setStats] = useState<Stats>(loadStats);
  const { guesses, hard, seasonGuesses } = game;

  const won = guesses.includes(answer.id);
  const done = won || guesses.length >= MAX_GUESSES;
  const wrong = guesses.length - (won ? 1 : 0);
  const cluesShown = done ? puzzle.clues.length : hard ? 0 : Math.min(wrong + 1, puzzle.clues.length);
  const blur = done ? 0 : BLUR_PX[Math.min(wrong, BLUR_PX.length - 1)];

  const hasBonus = season !== null && answer.seasons > 1;
  const bonusDone = !hasBonus || seasonGuesses.includes(season) || seasonGuesses.length >= MAX_SEASON_GUESSES;

  useEffect(() => {
    if (done) setStats(recordResult(puzzle.number, won, guesses.length));
  }, [done, won, guesses.length, puzzle.number]);

  const update = (patch: Partial<GameRecord>) => {
    const next = { ...game, ...patch };
    setGame(next);
    saveGame(puzzle.date, next);
  };

  const addGuess = (g: Guess) => {
    if (!done) update({ guesses: [...guesses, g] });
  };

  const toggleHard = () => {
    if (guesses.length > 0) return;
    saveHardPref(!hard);
    update({ hard: !hard });
  };

  const guessedIds = useMemo(() => new Set(guesses.filter((g): g is number => g !== null)), [guesses]);

  return (
    <>
      <div className="puzzle-meta">
        <span className="muted">#{puzzle.number}</span>
        <span className={`badge badge--${puzzle.difficulty.toLowerCase()}`}>{puzzle.difficulty}</span>
        <label className={`toggle ${guesses.length > 0 ? 'toggle--locked' : ''}`} title={guesses.length > 0 ? 'Locked once you start guessing' : 'Text clues stay hidden'}>
          <input type="checkbox" checked={hard} disabled={guesses.length > 0} onChange={toggleHard} />
          Hard mode
        </label>
        <span className="muted">
          Guess {Math.min(guesses.length + (done ? 0 : 1), MAX_GUESSES)}/{MAX_GUESSES}
        </span>
      </div>

      <figure className="screen">
        <img
          src={stillUrl(puzzle.still)}
          alt="A still from today's mystery episode"
          style={{ filter: blur ? `blur(${blur}px)` : undefined }}
        />
      </figure>

      <ol className="clues">
        {puzzle.clues.map((clue, i) => (
          <li key={clue.type} className={i < cluesShown ? 'clue' : 'clue clue--locked'}>
            <span className="clue__label">{clue.label}</span>
            <span className="clue__value">
              {i < cluesShown ? clue.value : hard ? 'Hidden in hard mode' : `Unlocks after ${i} wrong guess${i === 1 ? '' : 'es'}`}
            </span>
          </li>
        ))}
      </ol>

      {!done && (
        <GuessInput shows={shows} exclude={guessedIds} onGuess={(s) => addGuess(s.id)} onSkip={() => addGuess(null)} />
      )}

      {done && hasBonus && (
        <SeasonBonus
          seasons={answer.seasons}
          season={season}
          guesses={seasonGuesses}
          onGuess={(n) => update({ seasonGuesses: [...seasonGuesses, n] })}
        />
      )}

      {done && bonusDone && (
        <Result
          puzzle={puzzle}
          answer={answer}
          guesses={guesses}
          won={won}
          hard={hard}
          seasonGuesses={hasBonus ? seasonGuesses : null}
          season={season}
          stats={stats}
          maxGuesses={MAX_GUESSES}
        />
      )}

      {guesses.length > 0 && (
        <ol className="guesses">
          {[...guesses].reverse().map((g, i) => (
            <GuessRow key={guesses.length - i} guess={g === null ? null : byId.get(g) ?? null} answer={answer} />
          ))}
        </ol>
      )}
    </>
  );
}
