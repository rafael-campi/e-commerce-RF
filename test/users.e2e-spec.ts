import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let adminId: number;
  let userId: number;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminId = admin.id;
    adminToken = await loginAs(app, admin.email, admin.password);
    const user = await createUser(app, { role: UserType.USER });
    userId = user.id;
    userToken = await loginAs(app, user.email, user.password);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /users (cadastro público)', () => {
    it('cria usuário com papel USER e permite login com a senha', async () => {
      const response = await http()
        .post('/users')
        .send({ email: 'novo@example.com', password: 'segredo123' })
        .expect(201);

      expect(response.body.email).toBe('novo@example.com');
      expect(response.body.role).toBe(UserType.USER);
      expect(response.body.password).toBeUndefined();
      await loginAs(app, 'novo@example.com', 'segredo123');
    });

    it('ignora tentativa de se cadastrar como ADMIN', async () => {
      const response = await http()
        .post('/users')
        .send({
          email: 'espertinho@example.com',
          password: 'segredo123',
          role: UserType.ADMIN,
        })
        .expect(201);

      expect(response.body.role).toBe(UserType.USER);
    });

    it('rejeita e-mail inválido', async () => {
      await http()
        .post('/users')
        .send({ email: 'nao-e-email', password: 'segredo123' })
        .expect(400);
    });

    it('rejeita senha curta', async () => {
      await http()
        .post('/users')
        .send({ email: 'curta@example.com', password: '123' })
        .expect(400);
    });

    it('rejeita e-mail duplicado', async () => {
      await http()
        .post('/users')
        .send({ email: 'dup@example.com', password: 'segredo123' })
        .expect(201);

      await http()
        .post('/users')
        .send({ email: 'dup@example.com', password: 'segredo123' })
        .expect(400);
    });
  });

  describe('administração de usuários', () => {
    it('ADMIN lista usuários sem expor senhas', async () => {
      const response = await http()
        .get('/users')
        .set(bearer(adminToken))
        .expect(200);

      expect(response.body.length).toBeGreaterThan(1);
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('ADMIN atualiza um usuário', async () => {
      const target = await createUser(app);

      const response = await http()
        .patch(`/users/${target.id}`)
        .set(bearer(adminToken))
        .send({
          email: target.email,
          password: 'novasenha123',
          firstName: 'Maria',
        })
        .expect(200);

      expect(response.body.firstName).toBe('Maria');
      await loginAs(app, target.email, 'novasenha123');
    });

    it('ADMIN atualiza só o nome e preserva a senha', async () => {
      const target = await createUser(app);

      const response = await http()
        .patch(`/users/${target.id}`)
        .set(bearer(adminToken))
        .send({ firstName: 'Joana' })
        .expect(200);

      expect(response.body.firstName).toBe('Joana');
      expect(response.body.email).toBe(target.email);
      await loginAs(app, target.email, target.password);
    });

    it('ADMIN remove um usuário', async () => {
      const target = await createUser(app);

      await http()
        .delete(`/users/${target.id}`)
        .set(bearer(adminToken))
        .expect(200);

      await http()
        .get(`/users/${target.id}`)
        .set(bearer(adminToken))
        .expect(404);
    });

    it('usuário comum recebe 403 ao listar, atualizar e remover', async () => {
      const target = await createUser(app);

      await http().get('/users').set(bearer(userToken)).expect(403);
      await http()
        .patch(`/users/${target.id}`)
        .set(bearer(userToken))
        .send({ firstName: 'Hack' })
        .expect(403);
      await http()
        .delete(`/users/${target.id}`)
        .set(bearer(userToken))
        .expect(403);
    });
  });

  describe('GET /users/:id', () => {
    it('USER consulta a si mesmo', async () => {
      const response = await http()
        .get(`/users/${userId}`)
        .set(bearer(userToken))
        .expect(200);

      expect(response.body.id).toBe(userId);
    });

    it('USER não consulta outro usuário', async () => {
      await http()
        .get(`/users/${adminId}`)
        .set(bearer(userToken))
        .expect(403);
    });

    it('ADMIN consulta qualquer usuário', async () => {
      await http()
        .get(`/users/${userId}`)
        .set(bearer(adminToken))
        .expect(200);
    });
  });
});
