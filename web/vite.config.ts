import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A API NestJS roda em :3000; em dev o front fala com ela por /api (sem CORS).
const api = process.env.API_URL ?? 'http://localhost:3000';
// O PSP: tokenização de cartão e, só em dev, o simulador de Pix.
const psp = process.env.PSP_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: api, rewrite: (path) => path.replace(/^\/api/, '') },
      // o navegador fala com o PSP (tokenizar cartão, simular Pix) por /psp
      '/psp': {
        target: psp,
        rewrite: (path) => path.replace(/^\/psp/, ''),
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: api, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
