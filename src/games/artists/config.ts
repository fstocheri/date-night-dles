import { countryName, exactCell, numberCell } from '../../shared/compare';
import type { Entry, GameConfig } from '../../shared/types';
import { gameInfo } from '../registry';

export interface Artist extends Entry {
  // `year` is the debut album year.
  genre: string;
  country: string | null; // ISO 3166-1 code
  act: 'Solo (male)' | 'Solo (female)' | 'Solo' | 'Group' | 'Unknown';
  status: 'Active' | 'Ended' | null;
  photo: boolean;
}

// Must line up with FAN_BOUNDS in scripts/games/artists.mjs.
const FANS = ['Under 100K', '100K–500K', '500K–1M', '1–5M', '5–10M', '10M+'];

export const artistsConfig: GameConfig<Artist> = {
  ...gameInfo('artists'),
  placeholder: 'Type an artist…',
  subtitle: (a) => a.genre,
  imageUrl: (url) => url, // Deezer photo URLs are stored whole
  imageShape: 'square',
  compare: (g, a) => [
    numberCell('Debut', g.year, a.year, 3),
    exactCell('Genre', g.genre, a.genre),
    exactCell('Country', g.country, a.country, countryName(g.country)),
    exactCell('Act', g.act, a.act),
    exactCell('Status', g.status, a.status),
  ],
  bonus: {
    prompt: 'How many fans do they have on Deezer?',
    shareLabel: 'Fans',
    options: () => FANS,
  },
};
