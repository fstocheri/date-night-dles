import type { Guess } from './types';

// localStorage can throw or be empty (private mode, blocked storage); the games must still work.

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface GameRecord {
  guesses: Guess[];
  hard: boolean; // fixed once the first guess is made
  bonusGuesses: number[]; // option indexes
  /** Set when the main round ends, so the landing page can show results without the answer. */
  outcome?: 'won' | 'lost';
}

const gameKey = (gameId: string, date: string) => `dnd:${gameId}:game:${date}`;

export const loadGame = (gameId: string, date: string) =>
  read<GameRecord>(gameKey(gameId, date), { guesses: [], hard: loadHardPref(), bonusGuesses: [] });
export const saveGame = (gameId: string, date: string, game: GameRecord) => write(gameKey(gameId, date), game);

export const loadHardPref = () => read<boolean>('dnd:hard', false);
export const saveHardPref = (hard: boolean) => write('dnd:hard', hard);

export interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastPlayed: number; // puzzle number, so a game is only counted once
  lastWon: number;
  distribution: number[]; // wins by guess count, index 0 = first guess
}

const EMPTY_STATS: Stats = { played: 0, won: 0, streak: 0, maxStreak: 0, lastPlayed: 0, lastWon: 0, distribution: [0, 0, 0, 0, 0, 0] };

export const loadStats = (gameId: string) => read<Stats>(`dnd:${gameId}:stats`, EMPTY_STATS);

export function recordResult(gameId: string, puzzleNumber: number, won: boolean, guessCount: number): Stats {
  const s = loadStats(gameId);
  if (s.lastPlayed === puzzleNumber) return s;

  const streak = won ? (s.lastWon === puzzleNumber - 1 ? s.streak + 1 : 1) : 0;
  const distribution = [...s.distribution];
  if (won) distribution[guessCount - 1]++;

  const next: Stats = {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak, streak),
    lastPlayed: puzzleNumber,
    lastWon: won ? puzzleNumber : s.lastWon,
    distribution,
  };
  write(`dnd:${gameId}:stats`, next);
  return next;
}
