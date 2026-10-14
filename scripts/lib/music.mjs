// Music data for the music games: Deezer (catalog, popularity, artwork, audio previews)
// and MusicBrainz (artist facts). Neither needs an API key.

import path from 'node:path';
import { ROOT, readJson, sleep, writeJson } from './common.mjs';

/** Spaces calls to one host so concurrent callers share a rate limit. */
function throttle(intervalMs) {
  let next = 0;
  return async () => {
    const slot = Math.max(Date.now(), next);
    next = slot + intervalMs;
    if (slot > Date.now()) await sleep(slot - Date.now());
  };
}

// ---------- Deezer ----------

const deezerSlot = throttle(125); // ~8/s, under Deezer's 50 requests per 5 seconds

export async function deezer(endpoint, params = {}) {
  const url = new URL(`https://api.deezer.com${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; ; attempt++) {
    await deezerSlot();
    const res = await fetch(url).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    if (body && !body.error) return body;
    if (body?.error?.code === 800) throw new Error(`Deezer: no data for ${endpoint}`);
    // Deezer reports quota errors (code 4) with HTTP 200, so retry on any other failure.
    if (attempt < 5) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    throw new Error(`Deezer ${res?.status ?? 'network error'} on ${endpoint}: ${JSON.stringify(body?.error ?? '')}`);
  }
}

// Answers (not guesses) come from these artist origins. Deezer is biggest in France and Brazil,
// so its popularity ranking alone would skew answers away from what we know.
export const ANSWER_COUNTRIES = new Set(['US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'SE', 'NO']);

const ARTIST_CACHE = path.join(ROOT, 'data', 'musicbrainz-cache.json');

/** Deezer artist id -> origin country, from the MusicBrainz cache. */
export async function artistCountries() {
  const cache = await readJson(ARTIST_CACHE, {});
  return new Map(Object.entries(cache).map(([id, f]) => [Number(id), f?.country ?? null]));
}

// ---------- MusicBrainz ----------

const mbSlot = throttle(1100); // MusicBrainz allows 1 request per second
const MB_USER_AGENT = 'DateNightDles/0.1 ( https://github.com/fstocheri/date-night-dles )';

async function musicbrainz(endpoint, params) {
  const url = new URL(`https://musicbrainz.org/ws/2${endpoint}`);
  for (const [k, v] of Object.entries({ ...params, fmt: 'json' })) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    await mbSlot();
    const res = await fetch(url, { headers: { 'user-agent': MB_USER_AGENT, accept: 'application/json' } }).catch(() => null);
    if (res?.ok) return res.json();
    if (attempt < 4) {
      await sleep(3000 * (attempt + 1));
      continue;
    }
    throw new Error(`MusicBrainz ${res?.status ?? 'network error'} on ${endpoint}`);
  }
}

export const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Facts Deezer doesn't have: origin country, solo vs group, still active, debut album year.
 * Slow (2 requests per artist at 1/s), so results are cached in data/ and committed.
 */
export async function artistFacts(artists) {
  const cacheFile = ARTIST_CACHE;
  const cache = await readJson(cacheFile, {});
  const missing = artists.filter((a) => !(a.id in cache));
  if (missing.length) console.log(`  looking up ${missing.length} artists on MusicBrainz (~${Math.ceil((missing.length * 2.2) / 60)} min)…`);

  let done = 0;
  for (const artist of missing) {
    try {
      const search = await musicbrainz('/artist/', { query: `artist:"${artist.name.replace(/"/g, '')}"`, limit: 5 });
      const match =
        search.artists.find((a) => a.score >= 90 && normalize(a.name) === normalize(artist.name)) ??
        search.artists.find((a) => a.score === 100);
      if (!match) {
        cache[artist.id] = null;
      } else {
        const groups = await musicbrainz('/release-group', { artist: match.id, type: 'album', limit: 100 });
        const studio = groups['release-groups'].filter((g) => !g['secondary-types']?.length && g['first-release-date']);
        const debut = studio.map((g) => Number(g['first-release-date'].slice(0, 4))).sort((a, b) => a - b)[0] ?? null;
        cache[artist.id] = {
          mbid: match.id,
          type: match.type ?? null, // Person | Group | Orchestra | Choir | Character | Other
          gender: match.gender ?? null,
          country: match.country ?? match.area?.['iso-3166-1-codes']?.[0] ?? null,
          ended: Boolean(match['life-span']?.ended),
          debut,
        };
      }
    } catch (err) {
      console.warn(`  ${artist.name}: ${err.message}`);
      continue; // not cached, so it's retried next run
    }
    if (++done % 50 === 0) {
      await writeJson(cacheFile, cache, false); // checkpoint long runs
      console.log(`  …${done}/${missing.length}`);
    }
  }
  await writeJson(cacheFile, cache, false);
  return cache;
}

/**
 * Original release year per song. Deezer dates songs by the album version it hosts, which is
 * often a remaster or reissue (Sweet Child O' Mine → 2018); MusicBrainz tracks each recording's
 * first release. One request per song, so results are cached in data/ and committed.
 */
export async function originalYears(songs) {
  const cacheFile = path.join(ROOT, 'data', 'musicbrainz-recordings.json');
  const cache = await readJson(cacheFile, {});
  const missing = songs.filter((s) => !(s.id in cache));
  if (missing.length) console.log(`  dating ${missing.length} songs on MusicBrainz (~${Math.ceil((missing.length * 1.1) / 60)} min)…`);

  const clean = (s) => s.replace(/["\\]/g, '');
  let done = 0;
  for (const song of missing) {
    try {
      const res = await musicbrainz('/recording/', {
        query: `recording:"${clean(song.name)}" AND artist:"${clean(song.artist)}"`,
        limit: 15,
      });
      const artist = normalize(song.artist);
      const years = res.recordings
        .filter((r) => r.score >= 85 && normalize((r['artist-credit'] ?? []).map((c) => c.name).join(' ')).includes(artist))
        .map((r) => Number((r['first-release-date'] ?? '').slice(0, 4)))
        .filter((y) => y > 1900);
      cache[song.id] = years.length ? Math.min(...years) : null;
    } catch (err) {
      console.warn(`  ${song.name}: ${err.message}`);
      continue; // retried next run
    }
    if (++done % 100 === 0) {
      await writeJson(cacheFile, cache, false);
      console.log(`  …${done}/${missing.length}`);
    }
  }
  await writeJson(cacheFile, cache, false);
  return cache;
}

// ---------- the song catalog ----------

// Searches for Deezer editorial playlists; only playlists made by Deezer's own editors are used.
const PLAYLIST_QUERIES = [
  '60s hits', '70s hits', '80s hits', '90s hits', '2000s hits', '2010s hits', '2020s hits',
  'top usa', 'top uk', 'pop essentials', 'rock classics', 'classic rock', '80s rock', '90s rock',
  'hip hop classics', '90s hip hop', '2000s hip hop', 'r&b classics', '90s r&b', 'soul classics', 'motown',
  'country hits', 'country classics', 'dance classics', 'disco', 'indie classics', 'alternative classics',
  'pop punk', 'emo', 'one hit wonders', 'party hits', 'karaoke hits', 'road trip', 'love songs', 'throwback',
];
const PLAYLISTS_PER_QUERY = 3;
const MAX_SONGS = 3000;

const SONGS_FILE = path.join(ROOT, 'public', 'data', 'songs', 'catalog.json');

let songsPromise = null;

/** Popular songs from Deezer editorial playlists, most popular first. Built once per run. */
export function songCatalog() {
  songsPromise ??= (async () => {
    // Reuse a catalog the songs game just built in this run (or recently).
    const existing = await readJson(SONGS_FILE, null);
    if (existing && Date.now() - Date.parse(existing.generatedAt) < 60 * 60 * 1000) return existing.entries;
    return buildSongs();
  })();
  return songsPromise;
}

async function buildSongs() {
  const playlists = new Map();
  for (const q of PLAYLIST_QUERIES) {
    const res = await deezer('/search/playlist', { q, limit: 25 });
    res.data
      .filter((p) => /deezer/i.test(p.user?.name ?? ''))
      .slice(0, PLAYLISTS_PER_QUERY)
      .forEach((p) => playlists.set(p.id, p.title));
  }
  console.log(`  reading ${playlists.size} editorial playlists…`);

  const tracks = new Map();
  const seen = new Set(); // title|artist, to drop duplicate versions of the same song
  for (const id of playlists.keys()) {
    const res = await deezer(`/playlist/${id}/tracks`, { limit: 200 });
    for (const t of res.data) {
      const key = `${normalize(t.title_short)}|${t.artist.id}`;
      if (!t.readable || !t.preview || seen.has(key)) continue;
      seen.add(key);
      tracks.set(t.id, t);
    }
  }
  const top = [...tracks.values()].sort((a, b) => b.rank - a.rank).slice(0, MAX_SONGS);
  console.log(`  ${tracks.size} unique songs; fetching ${new Set(top.map((t) => t.album.id)).size} albums…`);

  // Albums give the release year and genre.
  const albums = new Map();
  for (const albumId of new Set(top.map((t) => t.album.id))) {
    try {
      albums.set(albumId, await deezer(`/album/${albumId}`));
    } catch (err) {
      console.warn(`  album ${albumId}: ${err.message}`);
    }
  }

  const songs = top
    .map((t) => {
      const album = albums.get(t.album.id);
      const year = Number((album?.release_date ?? '').slice(0, 4));
      if (!year) return null;
      return {
        id: t.id,
        name: t.title_short,
        artist: t.artist.name,
        artistId: t.artist.id,
        year,
        genre: album.genres?.data?.[0]?.name ?? 'Unknown',
        duration: t.duration,
        album: album.title,
        compilation: album.record_type === 'compile',
        lang: 'en',
      };
    })
    .filter(Boolean);

  const original = await originalYears(songs);
  return songs.map((s, rank) => {
    const year = original[s.id];
    // With a MusicBrainz date the year is trustworthy even for songs on compilations.
    return year && year <= s.year ? { ...s, year, compilation: false, rank } : { ...s, rank };
  });
}

/** "Body Music (Deluxe)" -> "Body Music": drop edition tags from album titles shown as clues. */
export function albumTitle(title) {
  const i = title.search(/ [([]/);
  return i > 0 && /deluxe|edition|remaster|expanded|anniversary|bonus/i.test(title.slice(i)) ? title.slice(0, i) : title;
}

/** "Taylor Swift" -> "T••••• S••••": the shape of a name without the letters. */
export const namePattern = (name) =>
  name
    .split(/\s+/)
    .map((w) => w[0] + w.slice(1).replace(/[\p{L}\p{N}]/gu, '•'))
    .join(' ');
