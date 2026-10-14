// Headliner: name the artist from a blurred photo and clues. Bonus: how many Deezer fans?

import { makeRedactor, seededIndex } from '../lib/common.mjs';
import { ANSWER_COUNTRIES, albumTitle, artistFacts, deezer, namePattern, songCatalog } from '../lib/music.mjs';

export const id = 'artists';

const ARTIST_LIMIT = 1200;
// Deezer fan count brackets: upper bounds. Labels live in src/games/artists/config.ts.
const FAN_BOUNDS = [100e3, 500e3, 1e6, 5e6, 10e6, Infinity];

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

function actOf(facts) {
  if (!facts?.type) return 'Unknown';
  const gender = facts.gender?.toLowerCase(); // MusicBrainz search returns lowercase
  if (facts.type === 'Person') return gender === 'male' ? 'Solo (male)' : gender === 'female' ? 'Solo (female)' : 'Solo';
  return 'Group';
}

// Deezer serves a placeholder image when an artist has no photo; its URL has an empty hash.
const hasPhoto = (url) => Boolean(url) && !url.includes('/artist//');

export async function buildCatalog() {
  const songs = await songCatalog();
  const byArtist = new Map();
  for (const s of songs) {
    const a = byArtist.get(s.artistId) ?? { name: s.artist, genres: new Map(), firstYear: Infinity };
    a.genres.set(s.genre, (a.genres.get(s.genre) ?? 0) + 1);
    if (!s.compilation) a.firstYear = Math.min(a.firstYear, s.year);
    byArtist.set(s.artistId, a);
  }

  console.log(`  fetching ${byArtist.size} artists from Deezer…`);
  const details = [];
  for (const artistId of byArtist.keys()) {
    try {
      details.push(await deezer(`/artist/${artistId}`));
    } catch (err) {
      console.warn(`  artist ${artistId}: ${err.message}`);
    }
  }
  const ranked = details.sort((a, b) => b.nb_fan - a.nb_fan).slice(0, ARTIST_LIMIT);
  const facts = await artistFacts(ranked.map((a) => ({ id: a.id, name: a.name })));

  return ranked.map((a, rank) => {
    const local = byArtist.get(a.id);
    const f = facts[a.id];
    return {
      id: a.id,
      name: a.name,
      year: f?.debut ?? (Number.isFinite(local.firstYear) ? local.firstYear : 0), // debut album
      genre: [...local.genres.entries()].sort((x, y) => y[1] - x[1])[0][0],
      country: f?.country ?? null,
      act: actOf(f),
      status: f ? (f.ended ? 'Ended' : 'Active') : null,
      photo: hasPhoto(a.picture_xl),
      lang: 'en',
      rank,
    };
  });
}

// Answers need a photo to blur and enough facts for the feedback tiles to be fair.
export const answerable = (entries) =>
  entries.filter((e) => e.photo && ANSWER_COUNTRIES.has(e.country) && e.act !== 'Unknown' && e.year);

export async function buildPuzzle(date, entry) {
  const artist = await deezer(`/artist/${entry.id}`);
  if (!hasPhoto(artist.picture_xl)) return null;
  const [top, albums] = await Promise.all([
    deezer(`/artist/${entry.id}/top`, { limit: 10 }),
    deezer(`/artist/${entry.id}/albums`, { limit: 50 }),
  ]);

  const hide = makeRedactor([entry.name], []);
  const NOT_STUDIO = /\b(live|greatest|hits|best of|collection|anthology|essential|edition|anniversary|remix|remaster|duets?|duetos|unplugged|tour)\b/i;
  const studio = albums.data.filter((a) => a.record_type === 'album' && !NOT_STUDIO.test(a.title));
  const album = studio.length ? studio[seededIndex(`${date}:album`, studio.length)] : null;
  const hit = top.data[0];
  const who = entry.act === 'Group' ? 'A group' : entry.act === 'Solo' ? 'A solo artist' : `A ${entry.act.toLowerCase().replace(/[()]/g, '')} artist`;

  return {
    still: artist.picture_xl,
    bonus: FAN_BOUNDS.findIndex((bound) => artist.nb_fan < bound),
    clues: [
      { type: 'genre', label: 'Genre', value: entry.genre },
      { type: 'origin', label: 'Origin', value: `${who} from ${regionNames.of(entry.country) ?? entry.country}` },
      { type: 'debut', label: 'Debut album', value: String(entry.year) },
      { type: 'album', label: 'Album', value: album ? `“${hide(albumTitle(album.title))}”` : 'No studio albums' },
      { type: 'hit', label: 'Biggest hit', value: hit ? `“${hide(hit.title_short)}”` : 'Unknown' },
      { type: 'pattern', label: 'Name', value: namePattern(entry.name) },
    ],
  };
}
