export interface Show {
  id: number;
  name: string;
  original?: string;
  year: number;
  network: string | null;
  genres: string[];
  seasons: number;
  rank: number;
}

export interface Catalog {
  generatedAt: string;
  shows: Show[];
}

export type ClueType = 'genres' | 'episode' | 'aired' | 'synopsis' | 'character' | 'actor';

export interface Clue {
  type: ClueType;
  label: string;
  value: string;
}

export interface Puzzle {
  date: string;
  number: number;
  answerHash: string;
  still: string;
  clues: Clue[];
}

/** A guessed show id, or null for a skipped turn. */
export type Guess = number | null;
