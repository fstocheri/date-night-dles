import type { Show } from './types';

export type Mark = 'hit' | 'near' | 'miss';

export interface Cell {
  label: string;
  value: string;
  mark: Mark;
  /** Which way the answer lies, for numeric attributes. */
  arrow?: '↑' | '↓';
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countryName = (code: string | null) => {
  if (!code) return '—';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

function numberCell(label: string, guess: number, answer: number, nearWithin: number): Cell {
  if (guess === answer) return { label, value: String(guess), mark: 'hit' };
  return {
    label,
    value: String(guess),
    mark: Math.abs(guess - answer) <= nearWithin ? 'near' : 'miss',
    arrow: answer > guess ? '↑' : '↓',
  };
}

function exactCell(label: string, guess: string | null, answer: string | null, display = guess ?? '—'): Cell {
  return { label, value: display, mark: guess !== null && guess === answer ? 'hit' : 'miss' };
}

/** Full match = hit, partial overlap = near, none = miss. */
function setCell(label: string, guess: string[], answer: string[]): Cell {
  const shared = guess.filter((g) => answer.includes(g)).length;
  const same = shared === guess.length && shared === answer.length && shared > 0;
  return { label, value: guess.join(', ') || '—', mark: same ? 'hit' : shared > 0 ? 'near' : 'miss' };
}

export function compare(guess: Show, answer: Show): Cell[] {
  const sharesCast = guess.cast.some((id) => answer.cast.includes(id));
  return [
    numberCell('Premiered', guess.year, answer.year, 3),
    exactCell('Network', guess.network, answer.network),
    setCell('Genres', guess.genres, answer.genres),
    numberCell('Seasons', guess.seasons, answer.seasons, 2),
    exactCell('Status', guess.status, answer.status),
    exactCell('Country', guess.country, answer.country, countryName(guess.country)),
    setCell('Creator', guess.creators, answer.creators),
    { label: 'Cast', value: sharesCast ? 'Shared actor' : 'No overlap', mark: sharesCast ? 'hit' : 'miss' },
  ];
}
