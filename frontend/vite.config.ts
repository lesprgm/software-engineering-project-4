import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Ensure proxy target is a valid absolute URL with protocol
  const raw = (env.VITE_API_BASE_URL || '').trim();
  const target = /^https?:\/\//i.test(raw) ? raw : 'http://localhost:8000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
