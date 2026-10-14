export const MAX_BONUS_GUESSES = 3;

interface Props {
  prompt: string;
  options: string[];
  answer: number; // index into options
  guesses: number[];
  onGuess: (index: number) => void;
}

/** Post-game bonus: pick the right option in 3 tries; arrows point toward the answer. */
export function ChoiceBonus({ prompt, options, answer, guesses, onGuess }: Props) {
  const solved = guesses.includes(answer);
  const done = solved || guesses.length >= MAX_BONUS_GUESSES;
  const left = MAX_BONUS_GUESSES - guesses.length;

  return (
    <section className="bonus">
      <h2>Bonus round</h2>
      <p className="muted">
        {done
          ? solved
            ? `Nailed it: ${options[answer]}.`
            : `It was ${options[answer]}.`
          : `${prompt} ${left} ${left === 1 ? 'try' : 'tries'} left.`}
      </p>
      <div className="choices">
        {options.map((label, i) => {
          const guessed = guesses.includes(i);
          const state = i === answer && done ? 'hit' : guessed ? 'miss' : '';
          return (
            <button
              key={label}
              type="button"
              className={`choice ${state && `choice--${state}`}`}
              disabled={done || guessed}
              onClick={() => onGuess(i)}
            >
              {label}
              {guessed && i !== answer && <span className="choice__arrow">{answer > i ? '↑' : '↓'}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
