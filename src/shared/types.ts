import type { ComponentType } from 'react';

/** Fields every game's catalog entries share. */
export interface Entry {
  id: number;
  name: string;
  original?: string;
  year: number;
  lang: string;
  rank: number; // 0 = most popular
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
  /** Image that unblurs with each miss (games without a custom Media component). */
  still?: string;
  /** Game-specific media reference, e.g. a Deezer track id. */
  media?: string;
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

export interface MediaProps<E extends Entry> {
  puzzle: Puzzle;
  answer: E;
  wrong: number; // wrong guesses so far (skips included)
  done: boolean;
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
  /** Extra text a guess can be found by, e.g. a song's artist. */
  searchAlso?: (entry: E) => string[];
  /** Secondary text beside a title in suggestions and results. Defaults to the year. */
  subtitle?: (entry: E) => string;
  /** Turns puzzle.still into a URL. Defaults to a TMDB image path. */
  imageUrl?: (still: string) => string;
  /** Shape of the still: a wide frame (default) or a square photo. */
  imageShape?: 'wide' | 'square';
  /** Replaces the blurred still entirely (e.g. an audio player). */
  Media?: ComponentType<MediaProps<E>>;
  /** Optional post-game bonus round: pick the right option, with higher/lower hints. */
  bonus?: {
    prompt: string;
    shareLabel: string;
    options: (answer: E) => string[];
  };
}
