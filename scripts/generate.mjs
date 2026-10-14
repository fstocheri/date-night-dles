// Builds the show catalog and daily puzzles from TMDB.
//
// The site is fully static: this script runs in CI (and locally via `npm run generate`)
// and writes JSON into public/data. The TMDB key never reaches the browser.
//
// Outputs:
//   public/data/shows.json            catalog used for autocomplete + guess feedback
//   public/data/puzzles/<date>.json   one puzzle per day (answer stored only as a hash)
//   data/history.json                 date -> answer show id, used to avoid repeats

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_DATA = path.join(ROOT, 'public', 'data');
const PUZZLE_DIR = path.join(PUBLIC_DATA, 'puzzles');
const CATALOG_FILE = path.join(PUBLIC_DATA, 'shows.json');
const HISTORY_FILE = path.join(ROOT, 'data', 'history.json');

const EPOCH = '2026-10-14'; // puzzle #1
const CATALOG_PAGES = 50; // 20 shows per page
const CATALOG_MAX_AGE_DAYS = 7;
const ANSWER_POOL_SIZE = 400; // answers come from the most-voted shows so they stay guessable
const NO_REPEAT_DAYS = 365;
const EXCLUDED_GENRES = new Set([10763, 10764, 10766, 10767]); // News, Reality, Soap, Talk

const KEY = process.env.TMDB_API_KEY?.trim();
if (!KEY) {
  console.error('TMDB_API_KEY is not set. Copy .env.example to .env and add your key.');
  process.exit(1);
}
const useBearer = KEY.startsWith('eyJ'); // v4 read access tokens are JWTs

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const headers = { accept: 'application/json' };
  if (useBearer) headers.authorization = `Bearer ${KEY}`;
  else url.searchParams.set('api_key', KEY);

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    // Never log the URL: it may carry the API key.
    throw new Error(`TMDB ${res.status} on ${endpoint}: ${await res.text()}`);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value, pretty = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, pretty ? 2 : 0) + '\n');
}

const dayMs = 24 * 60 * 60 * 1000;
const addDays = (date, n) => new Date(Date.parse(date) + n * dayMs).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);

function seededIndex(seed, n) {
  return crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) % n;
}

function seededShuffle(items, seed) {
  return items
    .map((item, i) => ({ item, k: crypto.createHash('sha256').update(`${seed}:${i}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}

// Must match answerHash() in src/lib/data.ts.
export function answerHash(date, id) {
  return crypto.createHash('sha256').update(`${date}:${id}`).digest('hex').slice(0, 16);
}

// ---------- catalog ----------

async function loadCatalog() {
  const existing = await readJson(CATALOG_FILE, null);
  if (existing && daysBetween(existing.generatedAt.slice(0, 10), new Date().toISOString().slice(0, 10)) < CATALOG_MAX_AGE_DAYS) {
    console.log(`Using cached catalog (${existing.shows.length} shows, ${existing.generatedAt}).`);
    return existing;
  }

  console.log('Building show catalog from TMDB…');
  const ranked = new Map();
  for (let page = 1; page <= CATALOG_PAGES; page++) {
    const res = await tmdb('/discover/tv', { sort_by: 'vote_count.desc', include_adult: false, page });
    for (const s of res.results) {
      if (!ranked.has(s.id) && !s.genre_ids.some((g) => EXCLUDED_GENRES.has(g))) ranked.set(s.id, ranked.size);
    }
    if (page >= res.total_pages) break;
  }

  const details = await mapLimit([...ranked.keys()], 8, (id) =>
    tmdb(`/tv/${id}`).catch((err) => {
      console.warn(`  skipped ${id}: ${err.message}`);
      return null;
    }),
  );

  const shows = details
    .filter((d) => d && d.first_air_date && d.number_of_seasons > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      ...(d.original_name && d.original_name !== d.name ? { original: d.original_name } : {}),
      year: Number(d.first_air_date.slice(0, 4)),
      network: d.networks?.[0]?.name ?? null,
      genres: d.genres.map((g) => g.name),
      seasons: d.number_of_seasons,
      rank: ranked.get(d.id),
    }))
    .sort((a, b) => a.rank - b.rank);

  const catalog = { generatedAt: new Date().toISOString(), shows };
  await writeJson(CATALOG_FILE, catalog, false);
  console.log(`Catalog: ${shows.length} shows.`);
  return catalog;
}

// ---------- redaction ----------

const STOPWORDS = new Set(['the', 'and', 'of', 'a', 'an', 'in', 'on', 'to', 'for', 'with', 'from', 'show']);
const GENERIC_ROLES = new Set(['Himself', 'Herself', 'Self', 'Themselves', 'Narrator', 'Voice', 'Host', 'Guest']);

function terms(str) {
  if (!str) return [];
  const parts = str.split(/[\s\-:,.!?'’"&/()]+/);
  return [str, ...parts].filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()) && !GENERIC_ROLES.has(t));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK = '▇▇▇';

function makeRedactor(show, cast) {
  const titleTerms = [...terms(show.name), ...terms(show.original_name)];
  const peopleTerms = cast
    .slice(0, 25)
    .flatMap((c) => [c.name, ...(c.roles ?? []).flatMap((r) => (r.character ?? '').split(/\s*\/\s*/))])
    .flatMap(terms)
    .filter((t) => /^\p{Lu}/u.test(t)); // only proper nouns, matched case-sensitively

  const rules = [
    ...[...new Set(titleTerms)].map((t) => [t, 'gi']),
    ...[...new Set(peopleTerms)].map((t) => [t, 'g']),
  ].sort((a, b) => b[0].length - a[0].length);

  return (text) => {
    let out = text;
    for (const [t, flags] of rules) out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t)}(?![\\p{L}\\p{N}])`, flags + 'u'), BLOCK);
    return out.replace(new RegExp(`${BLOCK}(?:\\s+${BLOCK})+`, 'g'), BLOCK);
  };
}

// ---------- puzzles ----------

async function buildPuzzle(date, entry) {
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

  const cast = [...(show.aggregate_credits?.cast ?? [])].sort((a, b) => b.total_episode_count - a.total_episode_count);
  const redact = makeRedactor(show, cast);
  const lead = cast[0];
  const character = (cast[1] ?? cast[0])?.roles?.[0]?.character?.replace(/\s*\(voice\)/i, '').trim();

  return {
    date,
    number: daysBetween(EPOCH, date) + 1,
    answerHash: answerHash(date, entry.id),
    still: episode.still_path,
    clues: [
      { type: 'genres', label: 'Genre', value: entry.genres.join(', ') || 'Unknown' },
      { type: 'episode', label: 'Episode', value: `Season ${episode.season_number}, Episode ${episode.episode_number}: “${redact(episode.name)}”` },
      { type: 'aired', label: 'Premiered', value: entry.network ? `${entry.year} on ${entry.network}` : String(entry.year) },
      { type: 'synopsis', label: 'Episode synopsis', value: redact(episode.overview || show.overview || 'No synopsis available.') },
      { type: 'character', label: 'Character', value: character || 'Unknown' },
      { type: 'actor', label: 'Starring', value: lead?.name ?? 'Unknown' },
    ],
  };
}

async function generateFor(date, catalog, history) {
  const recent = new Set(
    Object.entries(history)
      .filter(([d]) => d !== date && Math.abs(daysBetween(d, date)) < NO_REPEAT_DAYS)
      .map(([, id]) => id),
  );
  const pool = catalog.shows.slice(0, ANSWER_POOL_SIZE).filter((s) => !recent.has(s.id));

  for (let attempt = 0; attempt < 10; attempt++) {
    const entry = pool[seededIndex(`channel-surf:${date}:${attempt}`, pool.length)];
    const puzzle = await buildPuzzle(date, entry).catch((err) => {
      console.warn(`  ${entry.name}: ${err.message}`);
      return null;
    });
    if (puzzle) return { puzzle, id: entry.id };
  }
  throw new Error(`Could not build a puzzle for ${date}`);
}

async function main() {
  const catalog = await loadCatalog();
  const history = await readJson(HISTORY_FILE, {});

  // Today and tomorrow (UTC) cover every player's local date; never further ahead,
  // since everything in public/ is visible to anyone.
  const today = new Date().toISOString().slice(0, 10);
  for (const date of [today, addDays(today, 1)]) {
    const file = path.join(PUZZLE_DIR, `${date}.json`);
    if (await readJson(file, null)) {
      console.log(`${date}: already exists.`);
      continue;
    }
    const { puzzle, id } = await generateFor(date, catalog, history);
    await writeJson(file, puzzle);
    history[date] = id;
    console.log(`${date}: puzzle #${puzzle.number} generated.`);
  }

  await writeJson(HISTORY_FILE, Object.fromEntries(Object.entries(history).sort()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
