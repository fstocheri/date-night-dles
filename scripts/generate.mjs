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
import * as songs from './games/songs.mjs';
import * as artists from './games/artists.mjs';
import * as rock from './games/rock.mjs';
import * as tictac from './games/tictac.mjs';

// songs before artists: the artist catalog is built from the song catalog.
const GAMES = [tv, movies, songs, artists, rock, tictac];

const only = process.argv.slice(2);
const selected = only.length ? GAMES.filter((g) => only.includes(g.id)) : GAMES;

try {
  // Most games share the catalog/answer-pool loop; ones that don't bring their own run().
  for (const game of selected) await (game.run ? game.run() : runGame(game));
} catch (err) {
  console.error(err);
  process.exit(1);
}
