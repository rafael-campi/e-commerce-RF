// Liga a loja ao PSP próprio (payment-ledger-service, docs/adr/0001):
// cadastra a Loja Prateleira como lojista, registra o webhook e grava
// PSP_URL, PSP_SECRET_KEY, PSP_PUBLISHABLE_KEY e PSP_WEBHOOK_SECRET no .env
// (só essas chaves).
//
//   PLATFORM_ADMIN_TOKEN=<token do PSP> yarn psp:setup
//
// Opcionais: PSP_URL (http://localhost:3001) e WEBHOOK_URL, o endereço em
// que o PSP alcança esta API (http://localhost:3000/webhooks/payments).
// PSP_SETUP_ENV_FILE grava em outro arquivo (o docker-compose do api-gateway
// usa um volume compartilhado); se ele já existir, nada é refeito.
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const pspUrl = process.env.PSP_URL ?? 'http://localhost:3001';
const webhookUrl =
  process.env.WEBHOOK_URL ?? 'http://localhost:3000/webhooks/payments';
const platformToken = process.env.PLATFORM_ADMIN_TOKEN;
const envFile =
  process.env.PSP_SETUP_ENV_FILE ?? join(import.meta.dirname, '..', '..', '.env');

if (process.env.PSP_SETUP_ENV_FILE && existsSync(envFile)) {
  console.log(`${envFile} já existe: a loja já está ligada ao PSP.`);
  process.exit(0);
}

if (!platformToken) {
  console.error('Defina PLATFORM_ADMIN_TOKEN (o mesmo do .env do PSP).');
  process.exit(1);
}

// no docker-compose o PSP pode ainda estar aplicando migrations
for (let attempt = 1; ; attempt++) {
  const up = await fetch(pspUrl).then(
    () => true,
    () => false,
  );
  if (up) break;
  if (attempt === 60) {
    console.error(`O PSP não respondeu em ${pspUrl}.`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function post(path, token, body) {
  const response = await fetch(`${pspUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': randomUUID(),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path} respondeu ${response.status}: ${data?.message}`);
  }
  return data;
}

const merchant = await post('/platform/merchants', platformToken, {
  name: 'Loja Prateleira',
});
const secretKey = merchant.apiKeys.find((k) => k.type === 'secret').key;
// vai para o navegador, que tokeniza o cartão direto no PSP
const publishableKey = merchant.apiKeys.find(
  (k) => k.type === 'publishable',
).key;
const endpoint = await post('/v1/webhook_endpoints', secretKey, {
  url: webhookUrl,
});

const values = {
  PSP_URL: pspUrl,
  PSP_SECRET_KEY: secretKey,
  PSP_PUBLISHABLE_KEY: publishableKey,
  PSP_WEBHOOK_SECRET: endpoint.secret,
};
let env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
for (const [key, value] of Object.entries(values)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  env = pattern.test(env)
    ? env.replace(pattern, line)
    : `${env.replace(/\n?$/, '\n')}${line}\n`;
}
writeFileSync(envFile, env);

console.log(`Lojista ${merchant.id} criado no PSP (${pspUrl}).`);
console.log(`Webhook ${endpoint.id} → ${webhookUrl}`);
console.log(
  `PSP_URL, PSP_SECRET_KEY, PSP_PUBLISHABLE_KEY e PSP_WEBHOOK_SECRET gravados em ${envFile}.`,
);
console.log('Reinicie a API para ela passar a usar o PSP.');
