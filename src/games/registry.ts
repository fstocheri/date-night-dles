// The collection. Adding a game: a generator in scripts/games/, a config + main.tsx in
// src/games/<id>/, an HTML entry in <id>/index.html and vite.config.ts, and a line here.

export interface GameInfo {
  id: string;
  title: string;
  emoji: string;
  tagline: string;
  category: 'TV' | 'Movies';
}

export const GAMES: GameInfo[] = [
  { id: 'tv', title: 'Channel Surf', emoji: '📺', tagline: 'Name the TV show from a single episode.', category: 'TV' },
  { id: 'movies', title: 'Final Cut', emoji: '🎬', tagline: 'Name the movie from a single frame.', category: 'Movies' },
];

export const gameInfo = (id: string) => GAMES.find((g) => g.id === id)!;
