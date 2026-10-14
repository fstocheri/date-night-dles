import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Game } from './components/Game';
import { Layout } from './components/Layout';
import type { Entry, GameConfig } from './types';
import './styles.css';

/** Entry point for a game page: renders the shared layout around the game engine. */
export function mountGame<E extends Entry>(config: GameConfig<E>) {
  document.title = `${config.title} · Date Night Dles`;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Layout title={config.title} emoji={config.emoji} tagline={config.tagline} back>
        <Game config={config} />
      </Layout>
    </StrictMode>,
  );
}
