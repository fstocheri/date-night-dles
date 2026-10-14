import { useMemo, useState } from 'react';
import type { Show } from '../lib/types';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface Props {
  shows: Show[];
  exclude: Set<number>;
  onGuess: (show: Show) => void;
  onSkip: () => void;
}

export function GuessInput({ shows, exclude, onGuess, onSkip }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return shows
      .filter((s) => !exclude.has(s.id))
      .map((s) => {
        const names = [normalize(s.name), s.original ? normalize(s.original) : ''];
        const starts = names.some((n) => n.startsWith(q));
        const contains = starts || names.some((n) => n.includes(q));
        return { s, starts, contains };
      })
      .filter((m) => m.contains)
      .sort((a, b) => Number(b.starts) - Number(a.starts) || a.s.rank - b.s.rank)
      .slice(0, 8)
      .map((m) => m.s);
  }, [query, shows, exclude]);

  const choose = (show: Show) => {
    onGuess(show);
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="guess-input">
      <div className="guess-input__row">
        <input
          type="text"
          value={query}
          placeholder="Type a TV show…"
          aria-label="Guess a TV show"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="button button--ghost" onClick={onSkip}>
          Skip
        </button>
      </div>
      {matches.length > 0 && (
        <ul className="suggestions" role="listbox">
          {matches.map((s, i) => (
            <li
              key={s.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
            >
              <span>{s.name}</span>
              <span className="muted">{s.year}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
