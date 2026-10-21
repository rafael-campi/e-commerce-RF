import { execSync } from 'node:child_process';
import { testEnv } from '../playwright.config';

// Banco do zero com os dados da Prateleira (2 usuários, 12 produtos) antes da suíte.
export default function globalSetup() {
  execSync('yarn --cwd .. -s seed --reset', {
    env: { ...process.env, ...testEnv },
    stdio: 'inherit',
  });
}
