// Mosh Pit: Needle Drop, but only emo, pop punk, alternative, and rock.
// Same puzzle format as songs.mjs; only the song catalog differs.

import { ANSWER_COUNTRIES, artistCountries, songCatalog } from '../lib/music.mjs';
export { buildPuzzle } from './songs.mjs';

export const id = 'rock';

export const buildCatalog = () => songCatalog('rock');

// Many scene bands aren't in the artist-facts cache (it covers the main chart artists), so
// unknown origins are allowed; only artists known to be from elsewhere are left out.
export async function answerable(entries) {
  const countries = await artistCountries();
  return entries.filter((e) => {
    const country = countries.get(e.artistId);
    return !e.compilation && (country == null || ANSWER_COUNTRIES.has(country));
  });
}
