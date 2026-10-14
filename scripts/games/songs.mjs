// Needle Drop: name the song from a clip that grows with every miss (Heardle-style).
// The puzzle stores only the Deezer track id; preview links expire, so the browser
// fetches a fresh one when you play.

import { makeRedactor } from '../lib/common.mjs';
import { ANSWER_COUNTRIES, albumTitle, artistCountries, deezer, namePattern, normalize, songCatalog } from '../lib/music.mjs';

export const id = 'songs';

export const buildCatalog = () => songCatalog();

// Answers need a trustworthy year (compilations without a MusicBrainz date are out) and an
// artist from ANSWER_COUNTRIES; everything can still be guessed.
export async function answerable(entries) {
  const countries = await artistCountries();
  return entries.filter((e) => !e.compilation && ANSWER_COUNTRIES.has(countries.get(e.artistId)));
}

export async function buildPuzzle(date, entry) {
  const track = await deezer(`/track/${entry.id}`);
  if (!track.readable || !track.preview) return null;

  const top = await deezer(`/artist/${entry.artistId}/top`, { limit: 10 });
  const otherHit = top.data.find((t) => normalize(t.title_short) !== normalize(entry.name));
  const hideArtist = makeRedactor([entry.artist], []);
  const albumIsSingle = normalize(entry.album).startsWith(normalize(entry.name));

  return {
    media: String(entry.id),
    bonus: null,
    clues: [
      { type: 'genre', label: 'Genre', value: entry.genre },
      { type: 'released', label: 'Released', value: String(entry.year) },
      {
        type: 'album',
        label: 'Album',
        value: albumIsSingle ? 'Released as a single' : `“${makeRedactor([entry.name, entry.artist], [])(albumTitle(entry.album))}”`,
      },
      { type: 'other', label: 'Also by them', value: otherHit ? `“${hideArtist(otherHit.title_short)}”` : 'Nothing else in the charts' },
      { type: 'pattern', label: 'Initials', value: namePattern(entry.artist) },
      { type: 'artist', label: 'Artist', value: entry.artist },
    ],
  };
}
