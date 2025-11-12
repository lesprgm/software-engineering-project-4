import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { queryClient } from './lib/queryClient';
import { setupQueryPersistence } from './lib/queryPersistence';
import App from './App';
import { useAuthStore, mapProfileToAuthUser } from './store/auth';
import { usersService } from './services/users';
import { getRuntimeEnv } from './lib/env';
import './index.css';
// Leaflet CSS for react-leaflet map styling
import 'leaflet/dist/leaflet.css';

async function bootstrap() {
  const env = getRuntimeEnv();
  if (env.DEV && env.VITE_BYPASS_AUTH === '1') {
    const { login } = useAuthStore.getState();
    const existing = useAuthStore.getState().token;
    if (!existing) {
      try {
        let profile;
        try {
          profile = await usersService.lookup('dev@example.edu');
        } catch (lookupError) {
          if (axios.isAxiosError(lookupError) && lookupError.response?.status === 404) {
            profile = await usersService.createProfile({
              email: 'dev@example.edu',
              displayName: 'Dev User',
              password: 'password123',
            });
          } else {
            throw lookupError;
          }
        }
        login(profile.id, mapProfileToAuthUser(profile));
        // eslint-disable-next-line no-console
        console.info('[CampusConnect] Auth bypass active (DEV only)');
      } catch (error) {
        if (axios.isAxiosError(error)) {
          // eslint-disable-next-line no-console
          console.warn('Unable to bootstrap dev user', error.response?.data || error.message);
        }
      }
    }
  }

  setupQueryPersistence();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
