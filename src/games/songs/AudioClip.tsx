import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaProps } from '../../shared/types';
import { fetchTrack, type DeezerTrack } from './deezer';
import type { Song } from './config';

/** Seconds of audio unlocked after 0, 1, 2… wrong guesses. */
export const CLIP_SECONDS = [1, 2, 4, 7, 11, 16];
const FULL_PREVIEW = 30;

type TrackState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; track: DeezerTrack };

export function AudioClip({ puzzle, wrong, done }: MediaProps<Song>) {
  const [state, setState] = useState<TrackState>({ status: 'loading' });
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef(0);

  const limit = done ? FULL_PREVIEW : CLIP_SECONDS[Math.min(wrong, CLIP_SECONDS.length - 1)];
  const scale = done ? FULL_PREVIEW : CLIP_SECONDS[CLIP_SECONDS.length - 1];

  const load = useCallback(() => {
    setState({ status: 'loading' });
    fetchTrack(puzzle.media ?? '')
      .then((track) => setState({ status: 'ready', track }))
      .catch((err: Error) => setState({ status: 'error', message: err.message }));
  }, [puzzle.media]);

  useEffect(load, [load]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    audio.current?.pause();
    setPlaying(false);
  }, []);

  useEffect(() => stop, [stop]); // stop on unmount

  const play = async () => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = 0;
    setPosition(0);
    try {
      await el.play();
    } catch {
      return; // autoplay blocked or source failed; the error handler covers the latter
    }
    setPlaying(true);
    const tick = () => {
      setPosition(el.currentTime);
      if (el.currentTime >= limit || el.ended) stop();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  };

  if (state.status === 'loading') return <div className="player player--status">Cueing up the track…</div>;
  if (state.status === 'error') {
    return (
      <div className="player player--status">
        Couldn't load the clip ({state.message}).{' '}
        <button type="button" className="link-button" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="player">
      {done && <img className="player__cover" src={state.track.album.cover_xl} alt={`${state.track.album.title} cover`} />}
      <div className="player__controls">
        <button
          type="button"
          className="player__play"
          onClick={playing ? stop : play}
          aria-label={playing ? 'Stop' : `Play ${limit} second${limit === 1 ? '' : 's'}`}
        >
          {playing ? '■' : '▶'}
        </button>
        <div className="player__track">
          <div className="player__bar">
            <span className="player__unlocked" style={{ width: `${(limit / scale) * 100}%` }} />
            <span className="player__progress" style={{ width: `${(Math.min(position, limit) / scale) * 100}%` }} />
            {!done &&
              CLIP_SECONDS.slice(0, -1).map((s) => <span key={s} className="player__tick" style={{ left: `${(s / scale) * 100}%` }} />)}
          </div>
          <div className="player__meta muted">
            <span>{Math.min(position, limit).toFixed(1)}s</span>
            <span>{done ? 'Full preview unlocked' : `${limit}s unlocked · skip or miss for more`}</span>
          </div>
        </div>
      </div>
      {/* Re-fetch on error: preview links expire after a while. */}
      <audio ref={audio} src={state.track.preview} preload="auto" onError={load} />
    </div>
  );
}
