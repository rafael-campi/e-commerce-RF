import { defineConfig, devices } from '@playwright/test';

// Os testes rodam no navegador contra a API real e o banco de teste (docker compose up -d dbtest).
// Portas próprias (3100 e 5180) para não brigar com `yarn start:dev` e `yarn dev`.
export const API_PORT = 3100;
const WEB_PORT = 5180;

export const testEnv = {
  PORT: String(API_PORT),
  DB_HOST: 'localhost',
  DB_PORT: '5434',
  DB_USER: 'docker',
  DB_PASSWORD: 'docker',
  DB_NAME: 'ecommerce_test',
  SECRET_KEY_JWT: 'playwright',
  // gateway local (aprova na hora), mesmo que o .env de dev aponte para o PSP
  PSP_URL: '',
};

export default defineConfig({
  testDir: './e2e',
  // os cenários dividem o mesmo banco (estoque, carrinhos): um de cada vez
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'yarn --cwd .. start',
      env: testEnv,
      url: `http://localhost:${API_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `yarn vite --port ${WEB_PORT} --strictPort`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
