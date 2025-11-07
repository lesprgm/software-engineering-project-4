import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
import { useAuthStore } from './store/auth';
import './index.css';
// Leaflet CSS for react-leaflet map styling
import 'leaflet/dist/leaflet.css';

async function bootstrap() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === '1') {
    const { setupMockApi } = await import('./mocks/mockApi');
    setupMockApi();
    // eslint-disable-next-line no-console
    console.info('[CampusConnect] Mock API enabled');
  }

  if (import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === '1') {
    const { login } = useAuthStore.getState();
    const existing = useAuthStore.getState().token;
    if (!existing) {
      login('dev-bypass-token', {
        id: 'dev-user',
        name: 'Dev User',
        email: 'dev@example.edu',
        avatarUrl: '',
        interests: ['Tech', 'Music'],
      });
      // eslint-disable-next-line no-console
      console.info('[CampusConnect] Auth bypass active (DEV only)');
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
