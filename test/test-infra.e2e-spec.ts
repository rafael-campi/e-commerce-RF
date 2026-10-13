import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';

describe('Infraestrutura de testes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('usuário criado pelo helper consegue logar e obter JWT', async () => {
    const user = await createUser(app, { email: 'helper@example.com' });

    const token = await loginAs(app, user.email, user.password);

    expect(token.split('.')).toHaveLength(3);
  });

  it('cada suíte começa com banco limpo', async () => {
    await createUser(app, { email: 'limpo@example.com' });
    await app.close();

    app = await createTestApp();

    await expect(
      createUser(app, { email: 'limpo@example.com' }),
    ).resolves.toBeDefined();
  });
});
