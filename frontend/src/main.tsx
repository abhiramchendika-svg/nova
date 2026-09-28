import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/jetbrains-mono';
import './styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

async function enableMocksIfRequested(): Promise<void> {
  const wanted = import.meta.env.MODE === 'mock' || import.meta.env.VITE_API_MOCKS === 'true';
  if (!import.meta.env.DEV || !wanted) return;
  const { startMockApi } = await import('./mocks/browser');
  await startMockApi();
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

void enableMocksIfRequested().then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
