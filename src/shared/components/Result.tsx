import { useState } from 'react';
import type { Stats } from '../storage';
import type { Entry, Guess, Puzzle } from '../types';

interface Props {
  title: string;
  emoji: string;
  puzzle: Puzzle;
  answer: Entry;
  guesses: Guess[];
  won: boolean;
  hard: boolean;
  /** Bonus round line for the share text, or null when there was no bonus round. */
  bonus: { label: string; guesses: number[]; answer: number } | null;
  stats: Stats;
  maxGuesses: number;
}

export function Result({ title, emoji, puzzle, answer, guesses, won, hard, bonus, stats, maxGuesses }: Props) {
  const [copied, setCopied] = useState(false);

  const squares: string[] = guesses.map((g) => (g === answer.id ? '🟩' : g === null ? '⬛' : '🟥'));
  while (squares.length < maxGuesses) squares.push('⬜');
  const lines = [
    `${title} #${puzzle.number} ${emoji} ${won ? guesses.length : 'X'}/${maxGuesses}${hard ? '*' : ''} · ${puzzle.difficulty}`,
    squares.join(''),
  ];
  if (bonus) lines.push(`${bonus.label}: ${bonus.guesses.map((g) => (g === bonus.answer ? '🟩' : '🟥')).join('')}`);
  lines.push(location.href.split(/[?#]/)[0]);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
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
        It was <strong>{answer.name}</strong> ({answer.year})
      </p>
      <div className="result__actions">
        <button type="button" className="button" onClick={share}>
          {copied ? 'Copied!' : 'Share result'}
        </button>
        <a className="button button--ghost" href={import.meta.env.BASE_URL}>
          Next game →
        </a>
      </div>

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
