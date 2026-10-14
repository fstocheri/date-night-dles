// Shared plumbing for the puzzle generators: TMDB access, file IO, seeded picks,
// hashing, redaction, and the daily puzzle loop every game runs through.

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');

const EPOCH = '2026-10-14'; // puzzle #1 for every game
const CATALOG_MAX_AGE_DAYS = 7;
const NO_REPEAT_DAYS = 365;
export const ANSWER_LANGUAGES = new Set(['en']);

// Difficulty ramps through the week (UTC weekday, 0 = Sunday). `from`/`to` index into a
// 1,000-entry answer pool ordered by popularity, so Monday is a household name and Sunday a
// deep cut. Smaller pools scale the ranges proportionally.
const DIFFICULTY = [
  { label: 'Expert', from: 700, to: 1000 },
  { label: 'Easy', from: 0, to: 150 },
  { label: 'Easy', from: 0, to: 250 },
  { label: 'Medium', from: 150, to: 450 },
  { label: 'Medium', from: 250, to: 600 },
  { label: 'Hard', from: 400, to: 800 },
  { label: 'Hard', from: 500, to: 1000 },
];

// ---------- TMDB ----------

const KEY = process.env.TMDB_API_KEY?.trim();
const useBearer = KEY?.startsWith('eyJ'); // v4 read access tokens are JWTs

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function tmdb(endpoint, params = {}) {
  if (!KEY) throw new Error('TMDB_API_KEY is not set. Copy .env.example to .env and add your key.');
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

/** Page through a /discover endpoint by vote count, returning id -> popularity rank. */
export async function discoverRanked(kind, pages, keep = () => true) {
  const ranked = new Map();
  for (let page = 1; page <= pages; page++) {
    const res = await tmdb(`/discover/${kind}`, { sort_by: 'vote_count.desc', include_adult: false, page });
    for (const item of res.results) {
      if (!ranked.has(item.id) && keep(item)) ranked.set(item.id, ranked.size);
    }
    if (page >= res.total_pages) break;
  }
  return ranked;
}

export async function mapLimit(items, limit, fn) {
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

/** Fetch details for many ids, skipping (and logging) any that fail. */
export function fetchAll(ids, fn) {
  return mapLimit(ids, 10, (id) =>
    fn(id).catch((err) => {
      console.warn(`  skipped ${id}: ${err.message}`);
      return null;
    }),
  );
}

// ---------- files, dates, seeds, hashes ----------

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value, pretty = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, pretty ? 2 : 0) + '\n');
}

const dayMs = 24 * 60 * 60 * 1000;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date, n) => new Date(Date.parse(date) + n * dayMs).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / dayMs);

export function seededIndex(seed, n) {
  return crypto.createHash('sha256').update(seed).digest().readUInt32BE(0) % n;
}

export function seededShuffle(items, seed) {
  return items
    .map((item, i) => ({ item, k: crypto.createHash('sha256').update(`${seed}:${i}`).digest().readUInt32BE(0) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}

// Must match hashOf() in src/shared/data.ts. Answers are stored hashed so they aren't
// readable at a glance in the network tab.
export const hashOf = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

/** Cast sorted by how much they appear: episode count for TV, billing order for movies. */
export const mainCast = (credits) =>
  [...(credits?.cast ?? [])].sort((a, b) => (b.total_episode_count ?? 0) - (a.total_episode_count ?? 0) || (a.order ?? 0) - (b.order ?? 0));

// ---------- redaction ----------

const STOPWORDS = new Set(['the', 'and', 'of', 'a', 'an', 'in', 'on', 'to', 'for', 'with', 'from', 'show', 'movie']);
const GENERIC_ROLES = new Set(['Himself', 'Herself', 'Self', 'Themselves', 'Narrator', 'Voice', 'Host', 'Guest']);

function terms(str) {
  if (!str) return [];
  const parts = str.split(/[\s\-:,.!?'’"&/()]+/);
  return [str, ...parts].filter((t) => t.length >= 3 && !STOPWORDS.has(t.toLowerCase()) && !GENERIC_ROLES.has(t));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCK = '▇▇▇';

/**
 * Returns a function that blacks out title words (case-insensitive) and cast/character
 * names (proper nouns only, case-sensitive) so clues don't give the answer away.
 */
export function makeRedactor(titles, cast) {
  const titleTerms = titles.flatMap(terms);
  const peopleTerms = cast
    .slice(0, 25)
    .flatMap((c) => [c.name, ...(c.roles ?? [{ character: c.character }]).flatMap((r) => (r.character ?? '').split(/\s*\/\s*/))])
    .flatMap(terms)
    .filter((t) => /^\p{Lu}/u.test(t));

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

// ---------- the daily loop ----------

/**
 * Runs one game's generator. A game provides:
 *   id                                   folder name under public/data
 *   buildCatalog()                       -> entries sorted by rank, each with { id, name, lang, rank, ... }
 *   buildPuzzle(date, entry)             -> { still?, media?, clues, bonus: index | null } or null to try another entry
 *   answerable(entries)?                 -> entries eligible as answers (default: by ANSWER_LANGUAGES)
 */
export async function runGame(game) {
  const dir = path.join(ROOT, 'public', 'data', game.id);
  const catalogFile = path.join(dir, 'catalog.json');
  const historyFile = path.join(ROOT, 'data', `${game.id}-history.json`);

  let catalog = await readJson(catalogFile, null);
  if (catalog && daysBetween(catalog.generatedAt.slice(0, 10), today()) < CATALOG_MAX_AGE_DAYS) {
    console.log(`[${game.id}] using cached catalog (${catalog.entries.length} entries).`);
  } else {
    console.log(`[${game.id}] building catalog…`);
    catalog = { generatedAt: new Date().toISOString(), entries: await game.buildCatalog() };
    await writeJson(catalogFile, catalog, false);
    console.log(`[${game.id}] catalog: ${catalog.entries.length} entries.`);
  }

  const history = await readJson(historyFile, {});
  const answerable = game.answerable ? await game.answerable(catalog.entries) : catalog.entries.filter((e) => ANSWER_LANGUAGES.has(e.lang));
  const scale = Math.min(answerable.length, 1000) / 1000;

  // Today and tomorrow (UTC) cover every player's local date; never further ahead,
  // since everything in public/ is visible to anyone.
  for (const date of [today(), addDays(today(), 1)]) {
    const file = path.join(dir, 'puzzles', `${date}.json`);
    if (await readJson(file, null)) continue;

    const recent = new Set(
      Object.entries(history)
        .filter(([d]) => d !== date && Math.abs(daysBetween(d, date)) < NO_REPEAT_DAYS)
        .map(([, id]) => id),
    );
    const tier = DIFFICULTY[new Date(date).getUTCDay()];
    let pool = answerable.slice(Math.round(tier.from * scale), Math.round(tier.to * scale)).filter((e) => !recent.has(e.id));
    if (!pool.length) pool = answerable.filter((e) => !recent.has(e.id)); // tier exhausted

    let made = null;
    for (let attempt = 0; attempt < 10 && !made; attempt++) {
      const entry = pool[seededIndex(`${game.id}:${date}:${attempt}`, pool.length)];
      const built = await game.buildPuzzle(date, entry).catch((err) => {
        console.warn(`  ${entry.name}: ${err.message}`);
        return null;
      });
      if (built) made = { entry, built };
    }
    if (!made) throw new Error(`[${game.id}] could not build a puzzle for ${date}`);

    const { entry, built } = made;
    await writeJson(file, {
      date,
      number: daysBetween(EPOCH, date) + 1,
      difficulty: tier.label,
      answerHash: hashOf(`${date}:${entry.id}`),
      // The bonus answer is an option index; hashed for the same reason as the answer.
      bonusHash: built.bonus === null ? null : hashOf(`${date}:bonus:${built.bonus}`),
      ...(built.still ? { still: built.still } : {}),
      // Game-specific playable media (e.g. a Deezer track id the browser resolves at play time).
      ...(built.media ? { media: built.media } : {}),
      clues: built.clues,
    });
    history[date] = entry.id;
    console.log(`[${game.id}] ${date}: ${tier.label} puzzle generated.`);
  }

  await writeJson(historyFile, Object.fromEntries(Object.entries(history).sort()));
}
