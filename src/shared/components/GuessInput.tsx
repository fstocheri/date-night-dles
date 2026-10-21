import { useMemo, useState } from 'react';
import type { Entry } from '../types';

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

interface Props<E extends Entry> {
  entries: E[];
  exclude: Set<number>;
  placeholder: string;
  subtitle: (entry: E) => string;
  searchAlso?: (entry: E) => string[];
  onGuess: (entry: E) => void;
  onSkip: () => void;
}

export function GuessInput<E extends Entry>({ entries, exclude, placeholder, subtitle, searchAlso, onGuess, onSkip }: Props<E>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const words = q.split(' ');
    return entries
      .filter((e) => !exclude.has(e.id))
      .map((e) => {
        const names = [normalize(e.name), e.original ? normalize(e.original) : ''];
        const everything = [...names, ...(searchAlso?.(e) ?? []).map(normalize)].join(' ');
        // Best: the title starts with what you typed; then the title contains it; then every
        // word you typed appears somewhere in the title or the extra text (e.g. "love taylor").
        const tier = names.some((n) => n.startsWith(q)) ? 0 : names.some((n) => n.includes(q)) ? 1 : words.every((w) => everything.includes(w)) ? 2 : -1;
        return { e, tier };
      })
      .filter((m) => m.tier >= 0)
      .sort((a, b) => a.tier - b.tier || a.e.rank - b.e.rank)
      .slice(0, 10)
      .map((m) => m.e);
  }, [query, entries, exclude, searchAlso]);

  const choose = (entry: E) => {
    onGuess(entry);
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
          placeholder={placeholder}
          aria-label={placeholder}
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
          {matches.map((e, i) => (
            <li
              key={e.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                choose(e);
              }}
            >
              <span>{e.name}</span>
              <span className="muted">{subtitle(e)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
