import { useState } from 'react';
import type { Stats } from '../lib/storage';
import type { Guess, Puzzle, Show } from '../lib/types';

interface Props {
  puzzle: Puzzle;
  answer: Show;
  guesses: Guess[];
  won: boolean;
  stats: Stats;
  maxGuesses: number;
}

export function Result({ puzzle, answer, guesses, won, stats, maxGuesses }: Props) {
  const [copied, setCopied] = useState(false);

  const squares: string[] = guesses.map((g) => (g === answer.id ? '🟩' : g === null ? '⬛' : '🟥'));
  while (squares.length < maxGuesses) squares.push('⬜');
  const shareText = `Channel Surf #${puzzle.number} 📺 ${won ? guesses.length : 'X'}/${maxGuesses}\n${squares.join('')}\n${location.origin}${import.meta.env.BASE_URL}`;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable; nothing else to do.
    }
  };

  const maxBar = Math.max(1, ...stats.distribution);

  return (
    <section className="result">
      <h2>{won ? 'You got it!' : 'Signal lost.'}</h2>
      <p className="result__answer">
        The show was <strong>{answer.name}</strong> ({answer.year})
      </p>
      <button type="button" className="button" onClick={share}>
        {copied ? 'Copied!' : 'Share result'}
      </button>

      <div className="stats">
        <div><strong>{stats.played}</strong><span>Played</span></div>
        <div><strong>{stats.played ? Math.round((stats.won / stats.played) * 100) : 0}%</strong><span>Win %</span></div>
        <div><strong>{stats.streak}</strong><span>Streak</span></div>
        <div><strong>{stats.maxStreak}</strong><span>Best</span></div>
      </div>
      <ol className="distribution">
        {stats.distribution.map((n, i) => (
          <li key={i}>
            <span>{i + 1}</span>
            <span
              className={`bar ${won && guesses.length === i + 1 ? 'bar--today' : ''}`}
              style={{ width: `${Math.max(8, (n / maxBar) * 100)}%` }}
            >
              {n}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
