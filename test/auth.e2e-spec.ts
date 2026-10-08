import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('login com credenciais corretas retorna JWT', async () => {
    const user = await createUser(app);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);

    expect(response.body.access_token.split('.')).toHaveLength(3);
  });

  it('login com senha errada retorna 401', async () => {
    const user = await createUser(app);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'senha-errada' })
      .expect(401);
  });

  it('login com e-mail inexistente retorna 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ninguem@example.com', password: 'password123' })
      .expect(401);
  });

  it('rota protegida sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/products').expect(401);
  });

  it('rota protegida com token inválido retorna 401', async () => {
    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', 'Bearer token.invalido.aqui')
      .expect(401);
  });

  it('rota protegida com token válido é acessível', async () => {
    const user = await createUser(app);
    const token = await loginAs(app, user.email, user.password);

    await request(app.getHttpServer())
      .get('/products')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('rota por papel sem token retorna 401', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('nenhuma resposta expõe senha ou hash', async () => {
    const admin = await createUser(app, { role: UserType.ADMIN });
    const token = await loginAs(app, admin.email, admin.password);

    const response = await request(app.getHttpServer())
      .get(`/users/${admin.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.email).toBe(admin.email);
    expect(JSON.stringify(response.body)).not.toContain('password');
    expect(JSON.stringify(response.body)).not.toContain('$2');
  });
});

describe('Auth: papéis (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rota por papel avalia o usuário do token, não outro usuário', async () => {
    await createUser(app, { role: UserType.ADMIN });
    const common = await createUser(app, { role: UserType.USER });
    const token = await loginAs(app, common.email, common.password);

    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
