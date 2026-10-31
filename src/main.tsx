import '@fontsource-variable/orbitron';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource-variable/jetbrains-mono';
import '@/styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from '@/app/App';
import { reportWebVitals } from '@/lib/web-vitals';

reportWebVitals();

const container = document.getElementById('root');

if (!container) {
  throw new Error('Elemento #root não encontrado.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
