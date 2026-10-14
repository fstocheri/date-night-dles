import type { Guess } from './types';

// localStorage can throw or be empty (private mode, blocked storage); the game must still work.

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

export const loadGuesses = (date: string) => read<Guess[]>(`cs:game:${date}`, []);
export const saveGuesses = (date: string, guesses: Guess[]) => write(`cs:game:${date}`, guesses);

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

export const loadStats = () => read<Stats>('cs:stats', EMPTY_STATS);

export function recordResult(puzzleNumber: number, won: boolean, guessCount: number): Stats {
  const s = loadStats();
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
  write('cs:stats', next);
  return next;
}
