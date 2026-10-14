import type { Catalog, Entry, Puzzle } from './types';

const DATA = `${import.meta.env.BASE_URL}data`;

export const stillUrl = (path: string) => `https://image.tmdb.org/t/p/w780${path}`;

export async function loadCatalog<E extends Entry>(gameId: string): Promise<Catalog<E>> {
  const res = await fetch(`${DATA}/${gameId}/catalog.json`);
  if (!res.ok) throw new Error(`Could not load the catalog (${res.status})`);
  return res.json();
}

export async function loadPuzzle(gameId: string, date: string): Promise<Puzzle | null> {
  const res = await fetch(`${DATA}/${gameId}/puzzles/${date}.json`);
  if (!res.ok) return null;
  return res.json();
}

/** Must match hashOf() in scripts/lib/common.mjs. */
export async function hashOf(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/** The puzzle only stores a hash of the answer, so find it by hashing the catalog. */
export async function findAnswer<E extends Entry>(puzzle: Puzzle, entries: E[]): Promise<E | null> {
  const hashes = await Promise.all(entries.map((e) => hashOf(`${puzzle.date}:${e.id}`)));
  const i = hashes.indexOf(puzzle.answerHash);
  return i === -1 ? null : entries[i];
}

/** Likewise for the bonus round: returns the index of the correct option. */
export async function findBonus(puzzle: Puzzle, optionCount: number): Promise<number | null> {
  if (!puzzle.bonusHash) return null;
  for (let i = 0; i < optionCount; i++) {
    if ((await hashOf(`${puzzle.date}:bonus:${i}`)) === puzzle.bonusHash) return i;
  }
  return null;
}

/** The player's local calendar date, YYYY-MM-DD. */
export const localDate = () => new Date().toLocaleDateString('en-CA');
