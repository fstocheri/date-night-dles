// Date Night Dozen: 12 multiple-choice trivia questions a day in three rounds of rising
// difficulty, from the Open Trivia Database (opentdb.com, CC BY-SA 4.0, no key needed).
// Doesn't use the catalog/answer-pool loop in common.mjs, so it exports run() instead.

import path from 'node:path';
import { ROOT, hashOf, readJson, seededShuffle, sleep, writeJson } from '../lib/common.mjs';

export const id = 'trivia';

const EPOCH = '2026-10-14';
const ROUNDS = [
  { name: 'Round 1', difficulty: 'easy', points: 1 },
  { name: 'Round 2', difficulty: 'medium', points: 2 },
  { name: 'Round 3', difficulty: 'hard', points: 3 },
];
const PER_ROUND = 4;

// General-interest OpenTDB categories. Left out: video games, board games, anime, comics,
// cartoons, gadgets, computers, vehicles, musicals — big but niche.
const CATEGORIES = {
  9: 'General Knowledge', 10: 'Books', 11: 'Film', 12: 'Music', 14: 'Television',
  17: 'Science & Nature', 20: 'Mythology', 21: 'Sports', 22: 'Geography', 23: 'History',
  24: 'Politics', 25: 'Art', 26: 'Celebrities', 27: 'Animals',
};

let lastCall = 0;
/** OpenTDB allows one request per 5 seconds per IP. Returns [] when a category runs dry. */
async function fetchQuestions(category, difficulty) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastCall + 5500 - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const url = `https://opentdb.com/api.php?amount=10&type=multiple&encode=url3986&category=${category}&difficulty=${difficulty}`;
    const res = await fetch(url).then((r) => r.json()).catch(() => null);
    if (res?.response_code === 0) return res.results;
    if (res?.response_code === 1) return []; // not enough questions for this combo
    // 5 = rate limited; anything else, retry after the next slot
  }
  throw new Error(`OpenTDB kept failing for category ${category} (${difficulty})`);
}

const decode = (s) => decodeURIComponent(s).trim();

async function buildPuzzle(date, used) {
  const rounds = [];
  for (const [r, round] of ROUNDS.entries()) {
    const questions = [];
    // A different mix of categories each round and each day.
    for (const category of seededShuffle(Object.keys(CATEGORIES), `${date}:round${r}`)) {
      if (questions.length === PER_ROUND) break;
      const fresh = (await fetchQuestions(category, round.difficulty)).filter((q) => !used.has(hashOf(decode(q.question))));
      const q = fresh[0];
      if (!q) continue;
      used.add(hashOf(decode(q.question)));
      const choices = seededShuffle([q.correct_answer, ...q.incorrect_answers].map(decode), `${date}:${r}:${questions.length}`);
      const qi = r * PER_ROUND + questions.length;
      questions.push({
        category: CATEGORIES[category],
        question: decode(q.question),
        choices,
        // Hashed like the other games' answers so it isn't readable at a glance.
        answerHash: hashOf(`${date}:${qi}:${choices.indexOf(decode(q.correct_answer))}`),
      });
    }
    if (questions.length < PER_ROUND) throw new Error(`only found ${questions.length} ${round.difficulty} questions`);
    rounds.push({ name: round.name, difficulty: round.difficulty, points: round.points, questions });
  }
  const dayMs = 24 * 60 * 60 * 1000;
  return { date, number: Math.round((Date.parse(date) - Date.parse(EPOCH)) / dayMs) + 1, rounds };
}

export async function run() {
  const dir = path.join(ROOT, 'public', 'data', id, 'puzzles');
  const historyFile = path.join(ROOT, 'data', `${id}-history.json`);
  const history = await readJson(historyFile, { questions: [] });
  const used = new Set(history.questions);

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(today) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (const date of [today, tomorrow]) {
    const file = path.join(dir, `${date}.json`);
    if (await readJson(file, null)) continue;
    console.log(`[${id}] ${date}: fetching questions from OpenTDB…`);
    await writeJson(file, await buildPuzzle(date, used));
    console.log(`[${id}] ${date}: puzzle generated.`);
  }
  await writeJson(historyFile, { questions: [...used] }, false);
}
