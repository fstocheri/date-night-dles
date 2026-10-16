import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initCloud } from '../../shared/cloud';
import { Layout } from '../../shared/components/Layout';
import '../../shared/styles.css';
import { gameInfo } from '../registry';
import { TicTac } from './TicTac';

const info = gameInfo('tictac');
document.title = `${info.title} · Date Night Dles`;

void initCloud().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Layout title={info.title} emoji={info.emoji} tagline={info.tagline} back>
        <TicTac />
      </Layout>
    </StrictMode>,
  ),
);
