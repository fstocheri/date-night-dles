import type { Catalog, Puzzle, Show } from './types';

const DATA = `${import.meta.env.BASE_URL}data`;

export const stillUrl = (path: string) => `https://image.tmdb.org/t/p/w780${path}`;

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(`${DATA}/shows.json`);
  if (!res.ok) throw new Error(`Could not load shows (${res.status})`);
  return res.json();
}

export async function loadPuzzle(date: string): Promise<Puzzle | null> {
  const res = await fetch(`${DATA}/puzzles/${date}.json`);
  if (!res.ok) return null;
  return res.json();
}

/** Must match hashOf() in scripts/generate.mjs. */
export async function hashOf(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/** The puzzle only stores a hash of the answer, so find it by hashing the catalog. */
export async function findAnswer(puzzle: Puzzle, shows: Show[]): Promise<Show | null> {
  const hashes = await Promise.all(shows.map((s) => hashOf(`${puzzle.date}:${s.id}`)));
  const i = hashes.indexOf(puzzle.answerHash);
  return i === -1 ? null : shows[i];
}

/** Likewise for the bonus round's season number. */
export async function findSeason(puzzle: Puzzle, answer: Show): Promise<number | null> {
  for (let n = 1; n <= Math.max(answer.seasons, 1) + 5; n++) {
    if ((await hashOf(`${puzzle.date}:season:${n}`)) === puzzle.seasonHash) return n;
  }
  return null;
}

/** The player's local calendar date, YYYY-MM-DD. */
export const localDate = () => new Date().toLocaleDateString('en-CA');
