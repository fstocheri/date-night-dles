// Championship and award history from Wikidata, for generated sports trivia
// ("Which team won the 2008 World Series?"). Cached in data/sports-facts.json and refreshed
// weekly; if Wikidata is slow or down, the cache is used as is.

import path from 'node:path';
import { ROOT, readJson, sleep, writeJson } from './common.mjs';

const UA = 'DateNightDles/0.1 ( https://github.com/fstocheri/date-night-dles )';
const CACHE = path.join(ROOT, 'data', 'sports-facts.json');
const MAX_AGE_DAYS = 7;
const MIN_YEAR = 1970; // older champions are mostly unguessable

/**
 * Each competition: its Wikidata item, which square it feeds, how to clean winner labels,
 * and the question to ask. Editions are found as items whose league/competition is `id`.
 */
export const COMPETITIONS = [
  { key: 'superbowl', id: 'Q32096', level: 'pro', ask: (r) => `Which team won ${r.edition} (${r.year})?` },
  { key: 'nba', id: 'Q842375', level: 'pro', ask: (r) => `Which team won the ${r.year} NBA Finals?` },
  { key: 'worldseries', id: 'Q265538', level: 'pro', ask: (r) => `Which team won the ${r.year} World Series?` },
  { key: 'stanleycup', id: 'Q7599548', level: 'pro', ask: (r) => `Which team won the Stanley Cup in ${r.year}?` },
  { key: 'ncaam', id: 'Q996954', level: 'college', ask: (r) => `Which school won the ${r.year} NCAA men's basketball championship?` },
  { key: 'ncaaw', id: 'Q2948738', level: 'college', ask: (r) => `Which school won the ${r.year} NCAA women's basketball championship?` },
  { key: 'cfp', id: 'Q16256406', level: 'college', ask: (r) => `Which school won the College Football Playoff title game in January ${r.year}?` },
  { key: 'heisman', award: 'Q1035067', level: 'college', ask: (r) => `Who won the Heisman Trophy in ${r.year}?` },
];

// "UConn Huskies men's basketball" -> "UConn Huskies"; "Georgia Bulldogs football" -> "Georgia Bulldogs"
const cleanTeam = (label) =>
  label.replace(/ (men's basketball|women's basketball|football|baseball)$/i, '').trim();

async function sparql(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = new URL('https://query.wikidata.org/sparql');
    url.searchParams.set('query', query);
    url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/sparql-results+json' } }).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      return json.results.bindings.map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
    }
    await sleep(5000 * (attempt + 1));
  }
  throw new Error('Wikidata query failed');
}

const editionsQuery = (property, id) => `SELECT ?edLabel ?year ?winnerLabel WHERE {
  ?ed wdt:${property} wd:${id} ; wdt:P1346 ?winner .
  OPTIONAL { ?ed wdt:P585 ?d } OPTIONAL { ?ed wdt:P582 ?e } OPTIONAL { ?ed wdt:P580 ?s }
  BIND(YEAR(COALESCE(?d, ?e, ?s)) AS ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;

const awardQuery = (award) => `SELECT ?year ?winnerLabel WHERE {
  ?winner p:P166 ?st . ?st ps:P166 wd:${award} ; pq:P585 ?d . BIND(YEAR(?d) AS ?year)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;

async function fetchCompetition(c) {
  let rows = [];
  if (c.award) {
    rows = await sparql(awardQuery(c.award));
  } else {
    // Wikidata links editions to their competition inconsistently (league season, instance of,
    // part of), so gather all three and merge by year.
    for (const property of ['P3450', 'P31', 'P361']) {
      rows.push(...(await sparql(editionsQuery(property, c.id))));
      await sleep(1500);
    }
  }
  const byYear = new Map();
  for (const r of rows) {
    const year = Number(r.year);
    if (!year || year < MIN_YEAR || !r.winnerLabel || /^Q[0-9]+$/.test(r.winnerLabel)) continue;
    if (!byYear.has(year)) byYear.set(year, { year, winner: c.award ? r.winnerLabel : cleanTeam(r.winnerLabel), edition: r.edLabel });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/** { [competition key]: [{ year, winner, edition? }] } — cached, refreshed weekly. */
export async function sportsFacts() {
  const cached = await readJson(CACHE, null);
  if (cached && Date.now() - Date.parse(cached.fetchedAt) < MAX_AGE_DAYS * 86400000) return cached.facts;

  const facts = { ...(cached?.facts ?? {}) };
  for (const c of COMPETITIONS) {
    try {
      const rows = await fetchCompetition(c);
      if (rows.length >= 10) facts[c.key] = rows; // keep the old data if a query comes back thin
      console.log(`  ${c.key}: ${rows.length} champions since ${MIN_YEAR}`);
    } catch (err) {
      console.warn(`  ${c.key}: ${err.message}; using cached data`);
    }
    await sleep(1500);
  }
  await writeJson(CACHE, { fetchedAt: new Date().toISOString(), facts });
  return facts;
}
