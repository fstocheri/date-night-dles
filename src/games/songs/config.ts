import { exactCell, numberCell } from '../../shared/compare';
import type { Entry, GameConfig } from '../../shared/types';
import { gameInfo } from '../registry';
import { AudioClip } from './AudioClip';

export interface Song extends Entry {
  artist: string;
  artistId: number;
  genre: string;
  duration: number; // seconds
  album: string;
  compilation: boolean; // year may be the compilation's, not the song's
}

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const songsConfig: GameConfig<Song> = {
  ...gameInfo('songs'),
  placeholder: 'Type a song…',
  subtitle: (s) => s.artist,
  Media: AudioClip,
  compare: (g, a) => [
    exactCell('Artist', g.artist, a.artist),
    numberCell('Released', g.year, a.year, 3),
    exactCell('Genre', g.genre, a.genre),
    numberCell('Length', g.duration, a.duration, 20, minutes),
  ],
};
