// Raw browser storage. Everything is cached here so the site is instant and works offline;
// cloud.ts mirrors it to Supabase when signed in.
// localStorage can throw or be empty (private mode, blocked storage); callers must cope.

import type { Guess } from './types';

export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function keys(): string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k !== null);
  } catch {
    return [];
  }
}

// ---------- game records ----------

export interface GameRecord {
  guesses: Guess[];
  hard: boolean; // fixed once the first guess is made
  bonusGuesses: number[]; // option indexes
  /** Set when the main round ends. Quiz games use 'won' to mean finished. */
  outcome?: 'won' | 'lost';
  /** Quiz games: points scored. */
  score?: number;
}

const GAME_PREFIX = 'dnd:game:';
const gameKey = (gameId: string, date: string) => `${GAME_PREFIX}${gameId}:${date}`;

export const readGame = (gameId: string, date: string) => read<GameRecord | null>(gameKey(gameId, date), null);
export const writeGame = (gameId: string, date: string, record: GameRecord) => write(gameKey(gameId, date), record);

/** Every stored game, optionally for one game id. */
export function allGames(onlyGameId?: string): { gameId: string; date: string; record: GameRecord }[] {
  return keys()
    .filter((k) => k.startsWith(GAME_PREFIX))
    .map((k) => {
      const [gameId, date] = k.slice(GAME_PREFIX.length).split(':');
      return { gameId, date, record: read<GameRecord | null>(k, null) };
    })
    .filter((g): g is { gameId: string; date: string; record: GameRecord } => g.record !== null && (!onlyGameId || g.gameId === onlyGameId));
}

/**
 * Guesses only ever grow, so when two copies of the same day disagree, the one further
 * along is the right one. That makes syncing between devices conflict-free.
 */
export function isAhead(a: GameRecord, b: GameRecord): boolean {
  if (a.guesses.length !== b.guesses.length) return a.guesses.length > b.guesses.length;
  if (a.bonusGuesses.length !== b.bonusGuesses.length) return a.bonusGuesses.length > b.bonusGuesses.length;
  return Boolean(a.outcome) && !b.outcome;
}

// ---------- settings ----------

export const readHardPref = () => read<boolean>('dnd:hard', false);
export const writeHardPref = (hard: boolean) => write('dnd:hard', hard);

// ---------- links ----------

export interface CustomLink {
  id: string;
  name: string;
  url: string;
  /** An emoji, or 'favicon' to use the site's own icon. */
  icon: string;
}

export function readLinks(): CustomLink[] {
  const links = read<unknown>('dnd:links', []);
  return Array.isArray(links) ? (links as CustomLink[]) : [];
}
export const writeLinks = (links: CustomLink[]) => write('dnd:links', links);
