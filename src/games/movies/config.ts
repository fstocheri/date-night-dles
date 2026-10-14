import { castCell, countryName, exactCell, numberCell, setCell } from '../../shared/compare';
import type { Entry, GameConfig } from '../../shared/types';
import { gameInfo } from '../registry';

export interface Movie extends Entry {
  directors: string[];
  genres: string[];
  runtime: number; // minutes
  studio: string | null;
  country: string | null; // ISO 3166-1 code
  franchise: string | null;
}

// Must line up with BOX_OFFICE_BOUNDS in scripts/games/movies.mjs.
const BOX_OFFICE = ['Under $10M', '$10–50M', '$50–100M', '$100–250M', '$250–500M', '$500M–1B', '$1B+'];

const runtime = (min: number) => (min ? `${Math.floor(min / 60)}h ${min % 60}m` : '—');

export const moviesConfig: GameConfig<Movie> = {
  ...gameInfo('movies'),
  placeholder: 'Type a movie…',
  compare: (g, a) => [
    numberCell('Released', g.year, a.year, 3),
    setCell('Director', g.directors, a.directors),
    setCell('Genres', g.genres, a.genres),
    numberCell('Runtime', g.runtime, a.runtime, 15, runtime),
    exactCell('Studio', g.studio, a.studio),
    exactCell('Country', g.country, a.country, countryName(g.country)),
    exactCell('Franchise', g.franchise, a.franchise),
    castCell(g.cast, a.cast),
  ],
  bonus: {
    prompt: 'How much did it make at the worldwide box office?',
    shareLabel: 'Box office',
    options: () => BOX_OFFICE,
  },
};
