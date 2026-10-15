import { useEffect, useMemo, useRef, useState } from 'react';
import { hashOf, localDate } from '../../shared/data';
import { allGames, type GameRecord } from '../../shared/local';
import { loadGame, saveGame } from '../../shared/storage';
import { gameInfo } from '../registry';

const SECONDS = 20;
const DATA = `${import.meta.env.BASE_URL}data/trivia/puzzles`;

interface Question {
  category: string;
  question: string;
  choices: string[];
  answerHash: string;
}
interface Round {
  name: string;
  difficulty: string;
  points: number;
  questions: Question[];
}
interface Quiz {
  date: string;
  number: number;
  rounds: Round[];
}
/** A question with its round's points and the index of the right choice (resolved from the hash). */
interface Flat extends Question {
  round: Round;
  index: number;
  correct: number;
}

const info = gameInfo('trivia');

export function Trivia() {
  const [state, setState] = useState<{ quiz: Quiz; flat: Flat[] } | { error: string } | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${DATA}/${localDate()}.json`);
      if (!res.ok) throw new Error("Tonight's questions haven't been released yet. Check back soon.");
      const quiz: Quiz = await res.json();
      const flat: Flat[] = [];
      for (const round of quiz.rounds) {
        for (const q of round.questions) {
          const index = flat.length;
          const hashes = await Promise.all(q.choices.map((_, i) => hashOf(`${quiz.date}:${index}:${i}`)));
          flat.push({ ...q, round, index, correct: hashes.indexOf(q.answerHash) });
        }
      }
      setState({ quiz, flat });
    })().catch((err: Error) => setState({ error: err.message }));
  }, []);

  if (!state) return <p className="status">Shuffling the cards…</p>;
  if ('error' in state) return <p className="status">{state.error}</p>;
  return <Quiz quiz={state.quiz} flat={state.flat} />;
}

const scoreOf = (flat: Flat[], answers: (number | null)[]) =>
  answers.reduce<number>((sum, a, i) => sum + (a === flat[i].correct ? flat[i].round.points : 0), 0);

function Quiz({ quiz, flat }: { quiz: Quiz; flat: Flat[] }) {
  const [record, setRecord] = useState<GameRecord>(() => loadGame(info.id, quiz.date));
  const [started, setStarted] = useState(record.guesses.length > 0);
  /** Index of the question whose answer is being shown, before tapping Next. */
  const [reviewing, setReviewing] = useState<number | null>(null);

  const answers = record.guesses as (number | null)[];
  const maxScore = flat.reduce((sum, q) => sum + q.round.points, 0);
  const finished = answers.length >= flat.length;
  const score = scoreOf(flat, answers);

  const answer = (choice: number | null) => {
    if (reviewing !== null || finished) return;
    const next = [...answers, choice];
    const done = next.length >= flat.length;
    const updated: GameRecord = {
      ...record,
      guesses: next,
      ...(done ? { outcome: 'won' as const, score: scoreOf(flat, next) } : {}),
    };
    saveGame(info.id, quiz.date, updated);
    setRecord(updated);
    setReviewing(next.length - 1);
  };

  if (!started) {
    return (
      <section className="quiz-intro">
        <h2>Tonight's dozen</h2>
        <p className="muted">
          {flat.length} questions · {quiz.rounds.length} rounds · {SECONDS} seconds each
        </p>
        <ol className="quiz-rounds">
          {quiz.rounds.map((r) => (
            <li key={r.name}>
              <strong>{r.name}</strong> <span className="muted">· {r.difficulty} · {r.points} pt{r.points > 1 ? 's' : ''} each</span>
            </li>
          ))}
        </ol>
        <button type="button" className="button" onClick={() => setStarted(true)}>
          Start
        </button>
      </section>
    );
  }

  if (finished && reviewing === null) return <QuizResult quiz={quiz} flat={flat} answers={answers} score={score} maxScore={maxScore} />;

  const current = reviewing ?? answers.length;
  return (
    <QuestionCard
      key={current}
      q={flat[current]}
      total={flat.length}
      score={score}
      chosen={reviewing !== null ? answers[current] : undefined}
      onAnswer={answer}
      onNext={() => setReviewing(null)}
      isLast={current === flat.length - 1}
    />
  );
}

interface CardProps {
  q: Flat;
  total: number;
  score: number;
  /** undefined = still answering; null = ran out of time; number = picked choice. */
  chosen: number | null | undefined;
  onAnswer: (choice: number | null) => void;
  onNext: () => void;
  isLast: boolean;
}

function QuestionCard({ q, total, score, chosen, onAnswer, onNext, isLast }: CardProps) {
  const answered = chosen !== undefined;
  const [left, setLeft] = useState(SECONDS);
  const deadline = useRef(Date.now() + SECONDS * 1000);
  const answerRef = useRef(onAnswer);
  answerRef.current = onAnswer;

  // Countdown; time running out counts as no answer.
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

  const verdict = !answered ? null : chosen === q.correct ? 'right' : chosen === null ? 'timeout' : 'wrong';

  return (
    <section className="quiz-card">
      <div className="quiz-meta">
        <span className="muted">
          {q.round.name} · Question {q.index + 1}/{total}
        </span>
        <span className="quiz-score">{score} pt{score === 1 ? '' : 's'}</span>
      </div>
      <div className="quiz-timer" aria-hidden="true">
        <span style={{ width: `${(answered ? 0 : left / SECONDS) * 100}%` }} className={left < 5 ? 'quiz-timer--low' : ''} />
      </div>
      <span className="quiz-category">
        {q.category} · {q.round.points} pt{q.round.points > 1 ? 's' : ''}
      </span>
      <h2 className="quiz-question">{q.question}</h2>
      <div className="quiz-choices">
        {q.choices.map((choice, i) => {
          const state = !answered ? '' : i === q.correct ? 'correct' : i === chosen ? 'wrong' : 'dim';
          return (
            <button key={choice} type="button" className={`quiz-choice ${state && `quiz-choice--${state}`}`} disabled={answered} onClick={() => onAnswer(i)}>
              {choice}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`quiz-verdict quiz-verdict--${verdict}`}>
          <span>{verdict === 'right' ? `Correct! +${q.round.points}` : verdict === 'timeout' ? "Time's up" : 'Not quite'}</span>
          <button type="button" className="button" onClick={onNext} autoFocus>
            {isLast ? 'See results' : 'Next'}
          </button>
        </div>
      )}
      {!answered && <p className="quiz-left muted">{Math.ceil(left)}s</p>}
    </section>
  );
}

interface QuizStats {
  played: number;
  average: number;
  best: number;
  streak: number;
}

/** Stats from saved quizzes: streak = consecutive days played, ending today or yesterday. */
function quizStats(today: string): QuizStats {
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

function QuizResult({ quiz, flat, answers, score, maxScore }: { quiz: Quiz; flat: Flat[]; answers: (number | null)[]; score: number; maxScore: number }) {
  const [copied, setCopied] = useState(false);
  const stats = useMemo(() => quizStats(quiz.date), [quiz.date]);

  const grid = quiz.rounds
    .map((r) =>
      flat
        .filter((q) => q.round === r)
        .map((q) => (answers[q.index] === q.correct ? '🟩' : answers[q.index] === null ? '⬛' : '🟥'))
        .join(''),
    )
    .join(' | ');
  const shareText = `${info.title} #${quiz.number} ${info.emoji} ${score}/${maxScore}\n${grid}\n${location.href.split(/[?#]/)[0]}`;

  const share = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable.
    }
  };

  const right = flat.filter((q) => answers[q.index] === q.correct).length;
  return (
    <>
      <section className="reveal reveal--won">
        <h2>
          {score} / {maxScore} points
        </h2>
        <p>
          {right} of {flat.length} right · <span className="quiz-grid">{grid}</span>
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

      <h2 className="quiz-review-title">Tonight's answers</h2>
      <ol className="quiz-review">
        {flat.map((q) => {
          const mine = answers[q.index];
          const ok = mine === q.correct;
          return (
            <li key={q.index} className={ok ? 'is-right' : 'is-wrong'}>
              <span className="quiz-category">
                {q.round.name} · {q.category}
              </span>
              <p>{q.question}</p>
              <p>
                <strong>{q.choices[q.correct]}</strong>
                {!ok && <span className="muted"> · you said {mine === null ? 'nothing (time ran out)' : q.choices[mine]}</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}
