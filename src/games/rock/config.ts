import type { GameConfig } from '../../shared/types';
import { gameInfo } from '../registry';
import { songsConfig, type Song } from '../songs/config';

/** Same game as Needle Drop with its own catalog, puzzles, and stats. */
export const rockConfig: GameConfig<Song> = {
  ...songsConfig,
  ...gameInfo('rock'),
};
