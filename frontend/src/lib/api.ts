import axios from 'axios';
import { useAuthStore } from '../store/auth';

function resolveBaseURL() {
  if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === '1') {
    // When mocks are enabled, keep requests local and predictable
    return '/api';
  }
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw; // full URL
  // Default to Vite dev proxy path in development
  return '/api';
}

const api = axios.create({
  baseURL: resolveBaseURL(),
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default api;
