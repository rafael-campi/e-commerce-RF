import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A API NestJS roda em :3000; em dev o front fala com ela por /api (sem CORS).
const api = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: api, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
