// Building blocks for each game's feedback tiles.

import type { Cell } from './types';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string | null): string {
  if (!code) return '—';
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Exact = hit, within `nearWithin` = near; arrows point toward the answer. */
export function numberCell(label: string, guess: number, answer: number, nearWithin: number, format: (n: number) => string = String): Cell {
  if (guess === answer) return { label, value: format(guess), mark: 'hit' };
  return {
    label,
    value: format(guess),
    mark: Math.abs(guess - answer) <= nearWithin ? 'near' : 'miss',
    arrow: answer > guess ? '↑' : '↓',
  };
}

export function exactCell(label: string, guess: string | null, answer: string | null, display = guess ?? '—'): Cell {
  return { label, value: display, mark: guess !== null && guess === answer ? 'hit' : 'miss' };
}

/** Full match = hit, partial overlap = near, none = miss. */
export function setCell(label: string, guess: string[], answer: string[]): Cell {
  const shared = guess.filter((g) => answer.includes(g)).length;
  const same = shared > 0 && shared === guess.length && shared === answer.length;
  return { label, value: guess.join(', ') || '—', mark: same ? 'hit' : shared > 0 ? 'near' : 'miss' };
}

export function castCell(guess: number[], answer: number[]): Cell {
  const shared = guess.some((id) => answer.includes(id));
  return { label: 'Cast', value: shared ? 'Shared actor' : 'No overlap', mark: shared ? 'hit' : 'miss' };
}
