import { useEffect, useMemo, useState } from 'react';
import { findAnswer, findBonus, loadCatalog, loadPuzzle, localDate, stillUrl } from '../data';
import { computeStats, loadGame, saveGame, saveHardPref, type GameRecord, type Stats } from '../storage';
import type { Entry, GameConfig, Guess, Puzzle } from '../types';
import { ChoiceBonus, MAX_BONUS_GUESSES } from './ChoiceBonus';
import { GuessInput } from './GuessInput';
import { GuessRow } from './GuessRow';
import { Result } from './Result';

const MAX_GUESSES = 6;
const BLUR_PX = [28, 18, 11, 6, 3, 1]; // by number of wrong guesses

type Loaded<E extends Entry> = { puzzle: Puzzle; entries: E[]; answer: E; bonusAnswer: number | null };
type LoadState<E extends Entry> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: Loaded<E> };

/** Loads today's puzzle for a game and plays it. */
export function Game<E extends Entry>({ config }: { config: GameConfig<E> }) {
  const [load, setLoad] = useState<LoadState<E>>({ status: 'loading' });

  useEffect(() => {
    (async () => {
      const [catalog, puzzle] = await Promise.all([loadCatalog<E>(config.id), loadPuzzle(config.id, localDate())]);
      if (!puzzle) throw new Error("Today's puzzle hasn't been released yet. Check back soon.");
      const answer = await findAnswer(puzzle, catalog.entries);
      if (!answer) throw new Error("Today's puzzle is broken. We're looking into it.");
      const bonusAnswer = config.bonus ? await findBonus(puzzle, config.bonus.options(answer).length) : null;
      setLoad({ status: 'ready', data: { puzzle, entries: catalog.entries, answer, bonusAnswer } });
    })().catch((err: Error) => setLoad({ status: 'error', message: err.message }));
  }, [config]);

  if (load.status === 'loading') return <p className="status">Loading…</p>;
  if (load.status === 'error') return <p className="status">{load.message}</p>;
  return <Board config={config} {...load.data} />;
}

function Board<E extends Entry>({ config, puzzle, entries, answer, bonusAnswer }: { config: GameConfig<E> } & Loaded<E>) {
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);
  const [game, setGame] = useState<GameRecord>(() => loadGame(config.id, puzzle.date));
  const [stats, setStats] = useState<Stats>(() => computeStats(config.id, puzzle.date));
  const { guesses, hard, bonusGuesses } = game;
  const subtitle = config.subtitle ?? ((e: E) => String(e.year));

  const won = guesses.includes(answer.id);
  const done = won || guesses.length >= MAX_GUESSES;
  const wrong = guesses.length - (won ? 1 : 0);
  const cluesShown = done ? puzzle.clues.length : hard ? 0 : Math.min(wrong + 1, puzzle.clues.length);
  const blur = done ? 0 : BLUR_PX[Math.min(wrong, BLUR_PX.length - 1)];

  const bonusOptions = config.bonus && bonusAnswer !== null ? config.bonus.options(answer) : null;
  const bonusDone = !bonusOptions || bonusGuesses.includes(bonusAnswer!) || bonusGuesses.length >= MAX_BONUS_GUESSES;

  // Saved synchronously so stats computed right after see the change.
  const update = (patch: Partial<GameRecord>) => {
    const next = { ...game, ...patch };
    saveGame(config.id, puzzle.date, next);
    setGame(next);
  };

  useEffect(() => {
    if (!done) return;
    if (!game.outcome) update({ outcome: won ? 'won' : 'lost' });
    setStats(computeStats(config.id, puzzle.date));
  }, [done]); // runs once when the round ends

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

      {config.Media ? (
        <config.Media puzzle={puzzle} answer={answer} wrong={wrong} done={done} />
      ) : (
        puzzle.still && (
          <figure className={`screen ${config.imageShape === 'square' ? 'screen--square' : ''}`}>
            <img
              src={(config.imageUrl ?? stillUrl)(puzzle.still)}
              alt="Today's mystery image"
              style={{ filter: blur ? `blur(${blur}px)` : undefined }}
            />
          </figure>
        )
      )}

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
        <GuessInput
          entries={entries}
          exclude={guessedIds}
          placeholder={config.placeholder}
          subtitle={subtitle}
          onGuess={(e) => addGuess(e.id)}
          onSkip={() => addGuess(null)}
        />
      )}

      {/* Reveal the answer the moment the round ends, before any bonus round. */}
      {done && (
        <section className={`reveal reveal--${won ? 'won' : 'lost'}`} aria-live="polite">
          <h2>{won ? 'You got it!' : 'Out of guesses'}</h2>
          <p>
            It was <strong>{answer.name}</strong> ({subtitle(answer)})
          </p>
        </section>
      )}

      {done && config.bonus && bonusOptions && (
        <ChoiceBonus
          prompt={config.bonus.prompt}
          options={bonusOptions}
          answer={bonusAnswer!}
          guesses={bonusGuesses}
          onGuess={(i) => update({ bonusGuesses: [...bonusGuesses, i] })}
        />
      )}

      {done && bonusDone && (
        <Result
          title={config.title}
          emoji={config.emoji}
          puzzle={puzzle}
          answer={answer}
          guesses={guesses}
          won={won}
          hard={hard}
          bonus={config.bonus && bonusOptions ? { label: config.bonus.shareLabel, guesses: bonusGuesses, answer: bonusAnswer! } : null}
          stats={stats}
          maxGuesses={MAX_GUESSES}
        />
      )}

      {guesses.length > 0 && (
        <ol className="guesses">
          {[...guesses].reverse().map((g, i) => (
            <GuessRow
              key={guesses.length - i}
              guess={g === null ? null : byId.get(g) ?? null}
              answer={answer}
              compare={config.compare}
              subtitle={subtitle}
            />
          ))}
        </ol>
      )}
    </>
  );
}
