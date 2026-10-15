// What the games read and write: local storage first, mirrored to the cloud when signed in.

import { pushGame, pushSettings } from './cloud';
import { allGames, readGame, readHardPref, writeGame, writeHardPref, type GameRecord } from './local';

export type { GameRecord } from './local';

// Games used to be stored under dnd:<game>:game:<date>; move any of those to the new keys once.
(function migrateLegacyKeys() {
  try {
    for (const k of Object.keys(localStorage)) {
      const m = k.match(/^dnd:([a-z-]+):game:(\d{4}-\d{2}-\d{2})$/);
      if (m && !readGame(m[1], m[2])) writeGame(m[1], m[2], JSON.parse(localStorage.getItem(k)!));
      if (m) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
})();

export const loadGame = (gameId: string, date: string): GameRecord =>
  readGame(gameId, date) ?? { guesses: [], hard: readHardPref(), bonusGuesses: [] };

export function saveGame(gameId: string, date: string, record: GameRecord) {
  writeGame(gameId, date, record);
  pushGame(gameId, date, record);
}

export const loadHardPref = readHardPref;
export function saveHardPref(hard: boolean) {
  writeHardPref(hard);
  void pushSettings(hard);
}

export interface Stats {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  distribution: number[]; // wins by guess count, index 0 = first guess
}

const dayMs = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Math.round(Date.parse(date) / dayMs);

/**
 * Stats come straight from the saved games rather than a separate counter, so they're
 * always consistent across devices. A streak is consecutive days won, and it's only
 * current if the last win was today or yesterday.
 */
export function computeStats(gameId: string, today: string): Stats {
  const finished = allGames(gameId)
    .filter((g) => g.record.outcome)
    .sort((a, b) => a.date.localeCompare(b.date));

  const distribution = [0, 0, 0, 0, 0, 0];
  let won = 0;
  let run = 0;
  let maxStreak = 0;
  let lastDay: number | null = null;
  for (const { date, record } of finished) {
    const day = dayNumber(date);
    if (record.outcome === 'won') {
      won++;
      distribution[Math.min(record.guesses.length, 6) - 1]++;
      run = lastDay !== null && day - lastDay === 1 ? run + 1 : 1;
      maxStreak = Math.max(maxStreak, run);
    } else {
      run = 0;
    }
    lastDay = day;
  }
  const current = lastDay !== null && dayNumber(today) - lastDay <= 1 ? run : 0;
  return { played: finished.length, won, streak: current, maxStreak, distribution };
}

// Old per-game stats counters are now derived; drop them.
try {
  for (const k of Object.keys(localStorage)) if (/^dnd:[a-z-]+:stats$/.test(k)) localStorage.removeItem(k);
} catch {
  // ignore
}
