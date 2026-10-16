// Tic-Tac-Trivia: a 3x3 board of fixed categories, one multiple-choice question per square.
// Most squares come from the Open Trivia Database (opentdb.com, CC BY-SA 4.0); the US pro
// and college sports squares are generated from championship history on Wikidata, since
// OpenTDB has almost none. Doesn't use the catalog loop in common.mjs, so it exports run().

import path from 'node:path';
import { ROOT, hashOf, readJson, seededIndex, seededShuffle, sleep, writeJson } from '../lib/common.mjs';
import { COMPETITIONS, sportsFacts } from '../lib/sports.mjs';

export const id = 'tictac';

const EPOCH = '2026-10-14';

// Board layout, left to right, top to bottom. `opentdb` = category id; `sports` = generated.
const SQUARES = [
  { category: 'Sports (Pro)', emoji: '🏈', sports: 'pro' },
  { category: 'Sports (Pro)', emoji: '⚾', opentdb: 21 },
  { category: 'Sports (College)', emoji: '🎓', sports: 'college' },
  { category: 'Literature', emoji: '📚', opentdb: 10 },
  { category: 'Geography', emoji: '🌍', opentdb: 22 },
  { category: 'Pop Culture', emoji: '⭐', opentdb: 26 },
  { category: 'Music', emoji: '🎵', opentdb: 12 },
  { category: 'Television', emoji: '📺', opentdb: 14 },
  { category: 'Movies', emoji: '🎬', opentdb: 11 },
];

// ---------- OpenTDB ----------

let lastCall = 0;
/** OpenTDB allows one request per 5 seconds per IP. */
async function opentdb(category, difficulty) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + 5500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const url = `https://opentdb.com/api.php?amount=15&type=multiple&encode=url3986&category=${category}&difficulty=${difficulty}`;
    const res = await fetch(url).then((r) => r.json()).catch(() => null);
    if (res?.response_code === 0) return res.results;
    if (res?.response_code === 1) return [];
  }
  throw new Error(`OpenTDB kept failing for category ${category}`);
}

const decode = (s) => decodeURIComponent(s).trim();

// OpenTDB files some anime and kids' franchises under TV/Film/Music; keep those off the board.
const NICHE = /naruto|shippuden|pok[eé]mon|anime|manga|dragon ball|one piece|yu-gi-oh|sailor moon|gundam|evangelion|my little pony|bleach|jojo/i;

async function fromOpenTdb(square, seed, used) {
  // Mostly easy/medium: OpenTDB's "hard" tier is often obscure.
  const order = seededIndex(`${seed}:difficulty`, 3) === 0 ? ['medium', 'easy'] : ['easy', 'medium'];
  for (const difficulty of order) {
    const q = (await opentdb(square.opentdb, difficulty)).find(
      (r) => !used.has(hashOf(decode(r.question))) && !NICHE.test(`${decode(r.question)} ${decode(r.correct_answer)}`),
    );
    if (q) {
      return {
        question: decode(q.question),
        correct: decode(q.correct_answer),
        wrong: q.incorrect_answers.map(decode),
        difficulty,
      };
    }
  }
  throw new Error(`no unused ${square.category} questions`);
}

// ---------- generated sports ----------

function fromSports(level, seed, used, facts) {
  const pool = COMPETITIONS.filter((c) => c.level === level && (facts[c.key]?.length ?? 0) >= 8);
  for (let attempt = 0; attempt < 20; attempt++) {
    const comp = pool[seededIndex(`${seed}:comp:${attempt}`, pool.length)];
    const rows = facts[comp.key];
    const row = rows[seededIndex(`${seed}:row:${attempt}`, rows.length)];
    const question = comp.ask(row);
    if (used.has(hashOf(question))) continue;
    // Wrong answers: other winners from nearby years, so they're plausible.
    const nearby = [...new Set(rows.filter((r) => Math.abs(r.year - row.year) <= 12).map((r) => r.winner))].filter((w) => w !== row.winner);
    const others = [...new Set(rows.map((r) => r.winner))].filter((w) => w !== row.winner);
    const wrong = seededShuffle(nearby.length >= 3 ? nearby : others, `${seed}:wrong`).slice(0, 3);
    if (wrong.length < 3) continue;
    return { question, correct: row.winner, wrong, difficulty: 'generated' };
  }
  throw new Error(`could not generate a ${level} sports question`);
}

// ---------- puzzles ----------

async function buildPuzzle(date, used, facts) {
  const squares = [];
  for (const [i, square] of SQUARES.entries()) {
    const seed = `${date}:${i}`;
    const q = square.sports ? fromSports(square.sports, seed, used, facts) : await fromOpenTdb(square, seed, used);
    used.add(hashOf(q.question));
    const choices = seededShuffle([q.correct, ...q.wrong], `${seed}:choices`);
    squares.push({
      category: square.category,
      emoji: square.emoji,
      question: q.question,
      choices,
      // Hashed like the other games' answers so it isn't readable at a glance.
      answerHash: hashOf(`${date}:${i}:${choices.indexOf(q.correct)}`),
    });
  }
  return { date, number: Math.round((Date.parse(date) - Date.parse(EPOCH)) / 86400000) + 1, squares };
}

export async function run() {
  const dir = path.join(ROOT, 'public', 'data', id, 'puzzles');
  const historyFile = path.join(ROOT, 'data', `${id}-history.json`);
  const history = await readJson(historyFile, { questions: [] });
  const used = new Set(history.questions);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(today) + 86400000).toISOString().slice(0, 10);
  let facts = null;
  for (const date of [today, tomorrow]) {
    const file = path.join(dir, `${date}.json`);
    if (await readJson(file, null)) continue;
    facts ??= await sportsFacts();
    console.log(`[${id}] ${date}: building the board…`);
    await writeJson(file, await buildPuzzle(date, used, facts));
    console.log(`[${id}] ${date}: puzzle generated.`);
  }
  await writeJson(historyFile, { questions: [...used] }, false);
}
