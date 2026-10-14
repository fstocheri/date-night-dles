/** Fields every game's catalog entries share. */
export interface Entry {
  id: number;
  name: string;
  original?: string;
  year: number;
  cast: number[]; // TMDB person ids of the main cast
  lang: string;
  rank: number; // 0 = most voted on TMDB
}

export interface Catalog<E extends Entry> {
  generatedAt: string;
  entries: E[];
}

export interface Clue {
  type: string;
  label: string;
  value: string;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Expert';

export interface Puzzle {
  date: string;
  number: number;
  difficulty: Difficulty;
  answerHash: string;
  bonusHash: string | null;
  still: string;
  clues: Clue[];
}

/** A guessed entry id, or null for a skipped turn. */
export type Guess = number | null;

export type Mark = 'hit' | 'near' | 'miss';

export interface Cell {
  label: string;
  value: string;
  mark: Mark;
  /** Which way the answer lies, for numeric attributes. */
  arrow?: '↑' | '↓';
}

/** Everything that makes one game different from another; the engine handles the rest. */
export interface GameConfig<E extends Entry> {
  id: string; // data folder + storage namespace
  title: string;
  emoji: string;
  tagline: string;
  placeholder: string;
  /** Feedback tiles for a wrong guess. */
  compare: (guess: E, answer: E) => Cell[];
  /** Optional post-game bonus round: pick the right option, with higher/lower hints. */
  bonus?: {
    prompt: string;
    shareLabel: string;
    options: (answer: E) => string[];
  };
}
