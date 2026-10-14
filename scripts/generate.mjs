// Generates catalogs and daily puzzles for every game, from TMDB.
//
// The site is fully static: this runs in CI (and locally via `npm run generate`) and writes
// JSON into public/data/<game>/. The TMDB key never reaches the browser.
//
//   npm run generate            all games
//   npm run generate -- movies  just one

import { runGame } from './lib/common.mjs';
import * as tv from './games/tv.mjs';
import * as movies from './games/movies.mjs';

const GAMES = [tv, movies];

const only = process.argv.slice(2);
const selected = only.length ? GAMES.filter((g) => only.includes(g.id)) : GAMES;

try {
  for (const game of selected) await runGame(game);
} catch (err) {
  console.error(err);
  process.exit(1);
}
