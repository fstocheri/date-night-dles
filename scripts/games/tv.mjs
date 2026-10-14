// Channel Surf: name the TV show from one episode. Bonus: which season is it from?

import { discoverRanked, fetchAll, mainCast, makeRedactor, seededIndex, seededShuffle, tmdb } from '../lib/common.mjs';

const CATALOG_PAGES = 150; // 20 shows per page
const CAST_SIZE = 10; // cast ids per show, for "shares a cast member" feedback
const EXCLUDED_GENRES = new Set([10763, 10764, 10766, 10767]); // News, Reality, Soap, Talk
const RUNNING_STATUSES = new Set(['Returning Series', 'In Production', 'Planned', 'Pilot']);

export const id = 'tv';

export async function buildCatalog() {
  const ranked = await discoverRanked('tv', CATALOG_PAGES, (s) => !s.genre_ids.some((g) => EXCLUDED_GENRES.has(g)));
  console.log(`  fetching details for ${ranked.size} shows…`);
  const details = await fetchAll([...ranked.keys()], (showId) => tmdb(`/tv/${showId}`, { append_to_response: 'aggregate_credits' }));

  return details
    .filter((d) => d && d.first_air_date && d.number_of_seasons > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      ...(d.original_name && d.original_name !== d.name ? { original: d.original_name } : {}),
      year: Number(d.first_air_date.slice(0, 4)),
      network: d.networks?.[0]?.name ?? null,
      genres: d.genres.map((g) => g.name),
      seasons: d.number_of_seasons,
      status: RUNNING_STATUSES.has(d.status) ? 'Running' : 'Ended',
      country: d.origin_country?.[0] ?? null,
      creators: (d.created_by ?? []).map((c) => c.name),
      cast: mainCast(d.aggregate_credits).slice(0, CAST_SIZE).map((c) => c.id),
      lang: d.original_language,
      rank: ranked.get(d.id),
    }))
    .sort((a, b) => a.rank - b.rank);
}

export async function buildPuzzle(date, entry) {
  const show = await tmdb(`/tv/${entry.id}`, { append_to_response: 'aggregate_credits' });
  const seasons = show.seasons.filter((s) => s.season_number > 0 && s.episode_count > 0);

  let episode = null;
  for (const season of seededShuffle(seasons, `${date}:season`)) {
    const full = await tmdb(`/tv/${entry.id}/season/${season.season_number}`);
    const usable = full.episodes.filter((e) => e.still_path && e.name);
    if (usable.length) {
      episode = usable[seededIndex(`${date}:episode`, usable.length)];
      break;
    }
  }
  if (!episode) return null;

  const cast = mainCast(show.aggregate_credits);
  const redact = makeRedactor([show.name, show.original_name], cast);
  const character = (cast[1] ?? cast[0])?.roles?.[0]?.character?.replace(/\s*\(voice\)/i, '').trim();

  return {
    still: episode.still_path,
    // Bonus options are seasons 1..N, so the answer index is season - 1.
    bonus: entry.seasons > 1 ? episode.season_number - 1 : null,
    clues: [
      { type: 'genres', label: 'Genre', value: entry.genres.join(', ') || 'Unknown' },
      // No season number here: that's the bonus round's answer.
      { type: 'episode', label: 'Episode', value: `Episode ${episode.episode_number}: “${redact(episode.name)}”` },
      { type: 'aired', label: 'Premiered', value: entry.network ? `${entry.year} on ${entry.network}` : String(entry.year) },
      { type: 'synopsis', label: 'Episode synopsis', value: redact(episode.overview || show.overview || 'No synopsis available.') },
      { type: 'character', label: 'Character', value: character || 'Unknown' },
      { type: 'actor', label: 'Starring', value: cast[0]?.name ?? 'Unknown' },
    ],
  };
}
