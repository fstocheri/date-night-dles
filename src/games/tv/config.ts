import { castCell, countryName, exactCell, numberCell, setCell } from '../../shared/compare';
import type { Entry, GameConfig } from '../../shared/types';
import { gameInfo } from '../registry';

export interface Show extends Entry {
  network: string | null;
  genres: string[];
  seasons: number;
  status: 'Running' | 'Ended';
  country: string | null; // ISO 3166-1 code
  creators: string[];
  cast: number[]; // TMDB person ids of the main cast
}

export const tvConfig: GameConfig<Show> = {
  ...gameInfo('tv'),
  placeholder: 'Type a TV show…',
  compare: (g, a) => [
    numberCell('Premiered', g.year, a.year, 3),
    exactCell('Network', g.network, a.network),
    setCell('Genres', g.genres, a.genres),
    numberCell('Seasons', g.seasons, a.seasons, 2),
    exactCell('Status', g.status, a.status),
    exactCell('Country', g.country, a.country, countryName(g.country)),
    setCell('Creator', g.creators, a.creators),
    castCell(g.cast, a.cast),
  ],
  bonus: {
    prompt: 'Which season is this episode from?',
    shareLabel: 'Season',
    options: (answer) => Array.from({ length: answer.seasons }, (_, i) => String(i + 1)),
  },
};
