import { compare } from '../lib/compare';
import type { Show } from '../lib/types';

interface Props {
  guess: Show | null; // null = skipped
  answer: Show;
}

export function GuessRow({ guess, answer }: Props) {
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
        {guess.name}
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
