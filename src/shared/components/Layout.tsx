import type { ReactNode } from 'react';

interface Props {
  title: string;
  emoji: string;
  tagline: string;
  /** Show the "all games" link (every page but the landing page). */
  back?: boolean;
  children: ReactNode;
}

export function Layout({ title, emoji, tagline, back, children }: Props) {
  return (
    <div className="app">
      {back && (
        <nav className="topnav">
          <a href={import.meta.env.BASE_URL}>← Date Night Dles</a>
        </nav>
      )}
      <header className="header">
        <h1>
          <span aria-hidden="true">{emoji}</span> {title}
        </h1>
        <p className="muted">{tagline}</p>
      </header>

      <main>{children}</main>

      <footer className="footer">
        <p>
          Movie and TV data and images from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">
            TMDB
          </a>
          ; music from{' '}
          <a href="https://www.deezer.com/" target="_blank" rel="noreferrer">
            Deezer
          </a>{' '}
          and{' '}
          <a href="https://musicbrainz.org/" target="_blank" rel="noreferrer">
            MusicBrainz
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </footer>
    </div>
  );
}
