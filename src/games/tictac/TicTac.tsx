import { useEffect, useMemo, useRef, useState } from 'react';
import { hashOf, localDate } from '../../shared/data';
import { allGames, type GameRecord } from '../../shared/local';
import { loadGame, saveGame } from '../../shared/storage';
import { gameInfo } from '../registry';

const SECONDS = 30;
const DATA = `${import.meta.env.BASE_URL}data/tictac/puzzles`;
const info = gameInfo('tictac');

// Every row, column, and diagonal of the 3x3 board.
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

interface Square {
  category: string;
  emoji: string;
  question: string;
  choices: string[];
  answerHash: string;
}
interface Board {
  date: string;
  number: number;
  squares: Square[];
}
interface Resolved extends Square {
  index: number;
  correct: number;
}

/**
 * Moves are saved in the order played as square * 10 + choice (9 = time ran out). The list
 * only ever grows, which keeps cross-device syncing conflict-free.
 */
const TIMEOUT = 9;
type Answers = Map<number, number | null>; // square -> choice (null = time ran out)
function decode(moves: GameRecord['guesses']): Answers {
  const answers: Answers = new Map();
  for (const m of moves) if (typeof m === 'number') answers.set(Math.floor(m / 10), m % 10 === TIMEOUT ? null : m % 10);
  return answers;
}

export function TicTac() {
  const [state, setState] = useState<{ board: Board; squares: Resolved[] } | { error: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${DATA}/${localDate()}.json`);
      if (!res.ok) throw new Error("Tonight's board hasn't been released yet. Check back soon.");
      const board: Board = await res.json();
      const squares = await Promise.all(
        board.squares.map(async (s, index) => {
          const hashes = await Promise.all(s.choices.map((_, i) => hashOf(`${board.date}:${index}:${i}`)));
          return { ...s, index, correct: hashes.indexOf(s.answerHash) };
        }),
      );
      setState({ board, squares });
    })().catch((err: Error) => setState({ error: err.message }));
  }, []);

  if (!state) return <p className="status">Setting up the board…</p>;
  if ('error' in state) return <p className="status">{state.error}</p>;
  return <Game board={state.board} squares={state.squares} />;
}

function Game({ board, squares }: { board: Board; squares: Resolved[] }) {
  const [record, setRecord] = useState<GameRecord>(() => loadGame(info.id, board.date));
  const [open, setOpen] = useState<number | null>(null);

  const answers = useMemo(() => decode(record.guesses), [record.guesses]);
  const isRight = (i: number) => answers.has(i) && answers.get(i) === squares[i].correct;
  const score = squares.filter((s) => isRight(s.index)).length;
  const lines = LINES.filter((line) => line.every(isRight)).length;
  const finished = answers.size === squares.length;

  const answer = (square: number, choice: number | null) => {
    if (answers.has(square)) return;
    const guesses = [...record.guesses, square * 10 + (choice ?? TIMEOUT)];
    const next = decode(guesses);
    const done = next.size === squares.length;
    const nextScore = squares.filter((s) => next.has(s.index) && next.get(s.index) === s.correct).length;
    const updated: GameRecord = { ...record, guesses, ...(done ? { outcome: 'won' as const, score: nextScore } : {}) };
    saveGame(info.id, board.date, updated);
    setRecord(updated);
  };

  if (open !== null) {
    return (
      <QuestionCard
        key={open}
        square={squares[open]}
        chosen={answers.has(open) ? answers.get(open)! : undefined}
        onAnswer={(choice) => answer(open, choice)}
        onBack={() => setOpen(null)}
      />
    );
  }

  return (
    <>
      <div className="tictac-meta">
        <span className="muted">#{board.number}</span>
        <span className="muted">
          {finished ? 'Board complete' : `${answers.size} of 9 played · pick any square`}
        </span>
        <span className="quiz-score">
          {score}/9{lines > 0 && ` · ${lines} line${lines === 1 ? '' : 's'}`}
        </span>
      </div>

      <div className="tictac-board" role="grid" aria-label="Trivia board">
        {squares.map((s) => {
          const played = answers.has(s.index);
          const right = isRight(s.index);
          return (
            <button
              key={s.index}
              type="button"
              className={`tictac-square ${played ? (right ? 'tictac-square--right' : 'tictac-square--wrong') : ''}`}
              onClick={() => setOpen(s.index)}
              aria-label={`${s.category}${played ? (right ? ', answered right' : ', answered wrong') : ''}`}
            >
              <span className="tictac-square__mark" aria-hidden="true">
                {played ? (right ? '✓' : '✗') : s.emoji}
              </span>
              <span className="tictac-square__category">{s.category}</span>
              {played && <span className="tictac-square__hint">tap to review</span>}
            </button>
          );
        })}
      </div>

      {finished && <Results board={board} squares={squares} answers={answers} score={score} lines={lines} />}
    </>
  );
}

interface CardProps {
  square: Resolved;
  /** undefined = not answered yet; null = time ran out; number = picked choice. */
  chosen: number | null | undefined;
  onAnswer: (choice: number | null) => void;
  onBack: () => void;
}

function QuestionCard({ square, chosen, onAnswer, onBack }: CardProps) {
  const answered = chosen !== undefined;
  const [left, setLeft] = useState(SECONDS);
  const deadline = useRef(Date.now() + SECONDS * 1000);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  // Countdown once a square is opened; running out counts as no answer.
  useEffect(() => {
    if (answered) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, (deadline.current - Date.now()) / 1000);
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        answerRef.current(null);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [answered]);

  const verdict = !answered ? null : chosen === square.correct ? 'right' : chosen === null ? 'timeout' : 'wrong';

  return (
    <section className="quiz-card">
      <div className="quiz-meta">
        <span className="quiz-category">
          {square.emoji} {square.category}
        </span>
        {!answered && <span className="muted">{Math.ceil(left)}s</span>}
      </div>
      <div className="quiz-timer" aria-hidden="true">
        <span style={{ width: `${(answered ? 0 : left / SECONDS) * 100}%` }} className={left < 8 ? 'quiz-timer--low' : ''} />
      </div>
      <h2 className="quiz-question">{square.question}</h2>
      <div className="quiz-choices">
        {square.choices.map((choice, i) => {
          const state = !answered ? '' : i === square.correct ? 'correct' : i === chosen ? 'wrong' : 'dim';
          return (
            <button key={choice} type="button" className={`quiz-choice ${state && `quiz-choice--${state}`}`} disabled={answered} onClick={() => onAnswer(i)}>
              {choice}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-verdict quiz-verdict--${verdict}`}>
          <span>{verdict === 'right' ? 'Correct!' : verdict === 'timeout' ? "Time's up" : 'Not quite'}</span>
          <button type="button" className="button" onClick={onBack} autoFocus>
            Back to the board
          </button>
        </div>
      )}
    </section>
  );
}

/** Streak = consecutive days with a finished board, ending today or yesterday. */
function boardStats(today: string) {
  const done = allGames(info.id)
    .filter((g) => g.record.outcome && g.record.score != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  const day = (d: string) => Math.round(Date.parse(d) / 86400000);
  let run = 0;
  let last: number | null = null;
  for (const { date } of done) {
    run = last !== null && day(date) - last === 1 ? run + 1 : 1;
    last = day(date);
  }
  const scores = done.map((g) => g.record.score!);
  return {
    played: done.length,
    average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
    best: scores.length ? Math.max(...scores) : 0,
    streak: last !== null && day(today) - last <= 1 ? run : 0,
  };
}

function Results({ board, squares, answers, score, lines }: { board: Board; squares: Resolved[]; answers: Answers; score: number; lines: number }) {
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => boardStats(board.date), [board.date]);

  const cell = (s: Resolved) => (answers.get(s.index) === s.correct ? '🟩' : answers.get(s.index) === null ? '⬛' : '🟥');
  const grid = [0, 1, 2].map((r) => squares.slice(r * 3, r * 3 + 3).map(cell).join('')).join('\n');
  const headline = score === 9 ? 'Perfect board!' : lines > 0 ? `Tic-tac-toe! ${lines} line${lines === 1 ? '' : 's'}` : 'Board complete';
  const shareText = `${info.title} #${board.number} ${info.emoji} ${score}/9${lines ? ` · ${lines} line${lines === 1 ? '' : 's'}` : ''}\n${grid}\n${location.href.split(/[?#]/)[0]}`;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable.
    }
  };

  return (
    <>
      <section className={`reveal ${score >= 5 ? 'reveal--won' : 'reveal--lost'}`}>
        <h2>{headline}</h2>
        <p>
          <strong>{score} of 9</strong> right · tap any square to review it
        </p>
      </section>
      <section className="result">
        <div className="result__actions">
          <button type="button" className="button" onClick={share}>
            {copied ? 'Copied!' : 'Share result'}
          </button>
          <a className="button button--ghost" href={import.meta.env.BASE_URL}>
            Next game →
          </a>
        </div>
        <div className="stats">
          <div><strong>{stats.played}</strong><span>Played</span></div>
          <div><strong>{stats.average}</strong><span>Average</span></div>
          <div><strong>{stats.best}</strong><span>Best</span></div>
          <div><strong>{stats.streak}</strong><span>Streak</span></div>
        </div>
      </section>
    </>
  );
}
