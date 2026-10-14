// Final Cut: name the movie from a single frame. Bonus: how much did it make worldwide?

import { discoverRanked, fetchAll, mainCast, makeRedactor, seededIndex, tmdb } from '../lib/common.mjs';

const CATALOG_PAGES = 150; // 20 movies per page
const CAST_SIZE = 10;
const EXCLUDED_GENRES = new Set([99, 10770]); // Documentary, TV Movie
const MIN_REVENUE = 1_000_000; // below this TMDB revenue figures are usually missing or wrong

// Worldwide box office brackets: upper bounds. Labels live in src/games/movies/config.ts.
const BOX_OFFICE_BOUNDS = [10e6, 50e6, 100e6, 250e6, 500e6, 1e9, Infinity];

export const id = 'movies';

export async function buildCatalog() {
  const ranked = await discoverRanked('movie', CATALOG_PAGES, (m) => !m.genre_ids.some((g) => EXCLUDED_GENRES.has(g)));
  console.log(`  fetching details for ${ranked.size} movies…`);
  const details = await fetchAll([...ranked.keys()], (movieId) => tmdb(`/movie/${movieId}`, { append_to_response: 'credits' }));

  return details
    .filter((d) => d && d.release_date)
    .map((d) => ({
      id: d.id,
      name: d.title,
      ...(d.original_title && d.original_title !== d.title ? { original: d.original_title } : {}),
      year: Number(d.release_date.slice(0, 4)),
      directors: (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
      genres: d.genres.map((g) => g.name),
      runtime: d.runtime || 0,
      studio: d.production_companies?.[0]?.name ?? null,
      country: d.origin_country?.[0] ?? d.production_countries?.[0]?.iso_3166_1 ?? null,
      franchise: d.belongs_to_collection?.name?.replace(/\s+Collection$/, '') ?? null,
      cast: mainCast(d.credits).slice(0, CAST_SIZE).map((c) => c.id),
      lang: d.original_language,
      rank: ranked.get(d.id),
    }))
    .sort((a, b) => a.rank - b.rank);
}

export async function buildPuzzle(date, entry) {
  // include_image_language=null asks for text-free backdrops (no title treatment).
  const movie = await tmdb(`/movie/${entry.id}`, { append_to_response: 'credits,images', include_image_language: 'null' });

  const backdrops = (movie.images?.backdrops ?? [])
    .filter((b) => b.iso_639_1 === null)
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(0, 10);
  if (!backdrops.length) return null;
  const still = backdrops[seededIndex(`${date}:backdrop`, backdrops.length)].file_path;

  const cast = mainCast(movie.credits);
  const redact = makeRedactor([movie.title, movie.original_title, entry.franchise], cast);
  const character = (cast[1] ?? cast[0])?.character?.replace(/\s*\(voice\)/i, '').trim();
  const tagline = movie.tagline?.trim();

  return {
    still,
    bonus: movie.revenue >= MIN_REVENUE ? BOX_OFFICE_BOUNDS.findIndex((bound) => movie.revenue < bound) : null,
    clues: [
      { type: 'genres', label: 'Genre', value: entry.genres.join(', ') || 'Unknown' },
      tagline
        ? { type: 'tagline', label: 'Tagline', value: `“${redact(tagline)}”` }
        : { type: 'character', label: 'Character', value: character || 'Unknown' },
      { type: 'released', label: 'Released', value: entry.studio ? `${entry.year} · ${entry.studio}` : String(entry.year) },
      { type: 'synopsis', label: 'Plot', value: redact(movie.overview || 'No synopsis available.') },
      { type: 'director', label: 'Directed by', value: entry.directors.join(', ') || 'Unknown' },
      { type: 'actor', label: 'Starring', value: cast[0]?.name ?? 'Unknown' },
    ],
  };
}
