export const MAX_SEASON_GUESSES = 3;

interface Props {
  seasons: number; // how many seasons the answer has
  season: number; // the correct one
  guesses: number[];
  onGuess: (season: number) => void;
}

export function SeasonBonus({ seasons, season, guesses, onGuess }: Props) {
  const solved = guesses.includes(season);
  const done = solved || guesses.length >= MAX_SEASON_GUESSES;
  const left = MAX_SEASON_GUESSES - guesses.length;

  return (
    <section className="bonus">
      <h2>Bonus round</h2>
      <p className="muted">
        {done
          ? solved
            ? `Nailed it: season ${season}.`
            : `It was season ${season}.`
          : `Which season is this episode from? ${left} ${left === 1 ? 'try' : 'tries'} left.`}
      </p>
      <div className="seasons">
        {Array.from({ length: seasons }, (_, i) => i + 1).map((n) => {
          const guessed = guesses.includes(n);
          const state = n === season && (solved || done) ? 'hit' : guessed ? 'miss' : '';
          return (
            <button
              key={n}
              type="button"
              className={`season ${state && `season--${state}`}`}
              disabled={done || guessed}
              onClick={() => onGuess(n)}
              aria-label={`Season ${n}`}
            >
              {n}
              {guessed && n !== season && <span className="season__arrow">{season > n ? '↑' : '↓'}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
