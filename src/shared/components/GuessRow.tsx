import type { Cell, Entry } from '../types';

interface Props<E extends Entry> {
  guess: E | null; // null = skipped
  answer: E;
  compare: (guess: E, answer: E) => Cell[];
  subtitle: (entry: E) => string;
}

export function GuessRow<E extends Entry>({ guess, answer, compare, subtitle }: Props<E>) {
  if (!guess) {
    return (
      <li className="guess guess--skip">
        <div className="guess__name">Skipped</div>
      </li>
    );
  }

  const correct = guess.id === answer.id;
  return (
    <li className={`guess ${correct ? 'guess--correct' : ''}`}>
      <div className="guess__name">
        {correct ? '✓ ' : '✗ '}
        {guess.name} <span className="muted">({subtitle(guess)})</span>
      </div>
      {!correct && (
        <div className="guess__cells">
          {compare(guess, answer).map((c) => (
            <div key={c.label} className={`cell cell--${c.mark}`}>
              <span className="cell__label">{c.label}</span>
              <span className="cell__value">
                {c.value} {c.arrow && <span aria-label={c.arrow === '↑' ? 'answer is higher' : 'answer is lower'}>{c.arrow}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
