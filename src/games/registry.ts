// The collection. Adding a game: a generator in scripts/games/, a config + main.tsx in
// src/games/<id>/, an HTML entry in <id>/index.html and vite.config.ts, and a line here.

export interface GameInfo {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  category: 'TV' | 'Movies' | 'Music' | 'Trivia';
  /** Quiz games are scored in points rather than solved in N guesses. */
  quiz?: { questions: number; maxScore: number };
}

export const GAMES: GameInfo[] = [
  { id: 'tv', title: 'Channel Surf', emoji: '📺', tagline: 'Name the TV show from a single episode.', category: 'TV' },
  { id: 'movies', title: 'Final Cut', emoji: '🎬', tagline: 'Name the movie from a single frame.', category: 'Movies' },
  { id: 'songs', title: 'Needle Drop', emoji: '🎧', tagline: 'Name the song from a clip that grows with every miss.', category: 'Music' },
  { id: 'trivia', title: 'Date Night Dozen', emoji: '🧠', tagline: 'Twelve trivia questions, three rounds, twenty seconds each.', category: 'Trivia', quiz: { questions: 12, maxScore: 24 } },
  { id: 'rock', title: 'Mosh Pit', emoji: '🤘', tagline: 'Needle Drop, but only emo, pop punk, alternative, and rock.', category: 'Music' },
  { id: 'artists', title: 'Headliner', emoji: '🎤', tagline: 'Name the artist from a blurred photo and clues.', category: 'Music' },
];

export const gameInfo = (id: string) => GAMES.find((g) => g.id === id)!;
