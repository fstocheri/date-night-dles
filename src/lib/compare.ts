import type { Show } from './types';

export type Mark = 'hit' | 'near' | 'miss';

export interface Cell {
  label: string;
  value: string;
  mark: Mark;
  /** Which way the answer lies, for numeric attributes. */
  arrow?: '↑' | '↓';
}

function numberCell(label: string, guess: number, answer: number, nearWithin: number): Cell {
  if (guess === answer) return { label, value: String(guess), mark: 'hit' };
  return {
    label,
    value: String(guess),
    mark: Math.abs(guess - answer) <= nearWithin ? 'near' : 'miss',
    arrow: answer > guess ? '↑' : '↓',
  };
}

export function compare(guess: Show, answer: Show): Cell[] {
  const shared = guess.genres.filter((g) => answer.genres.includes(g)).length;
  const sameGenres = shared === guess.genres.length && shared === answer.genres.length;

  return [
    numberCell('Premiered', guess.year, answer.year, 3),
    {
      label: 'Network',
      value: guess.network ?? '—',
      mark: guess.network !== null && guess.network === answer.network ? 'hit' : 'miss',
    },
    {
      label: 'Genres',
      value: guess.genres.join(', ') || '—',
      mark: sameGenres ? 'hit' : shared > 0 ? 'near' : 'miss',
    },
    numberCell('Seasons', guess.seasons, answer.seasons, 2),
  ];
}
