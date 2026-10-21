import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app';
import { seed } from '../src/database/seeds/seed';
import { UserType } from '../src/enums/user-types.enum';

describe('Seed (e2e)', () => {
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  const login = async (email: string) =>
    (
      await http()
        .post('/auth/login')
        .send({ email, password: '123456' })
        .expect(201)
    ).body.access_token;

  const me = async (token: string) =>
    (
      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;

  beforeAll(async () => {
    app = await createTestApp();
    await seed(app.get(DataSource));
  });

  afterAll(async () => {
    await app.close();
  });

  it('cria o administrador e o cliente da Loja Prateleira com senha 123456', async () => {
    expect(await me(await login('admin@prateleira.com'))).toMatchObject({
      firstName: 'Helena',
      lastName: 'Prado',
      role: UserType.ADMIN,
    });
    expect(await me(await login('cliente@prateleira.com'))).toMatchObject({
      firstName: 'Marcos',
      lastName: 'Teixeira',
      role: UserType.USER,
    });
  });

  it('cria os 12 produtos do catálogo, incluindo os esgotados', async () => {
    const token = await login('cliente@prateleira.com');
    const products = (
      await http()
        .get('/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;

    expect(products).toHaveLength(12);
    expect(products).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Fone Bluetooth Aura',
          price: '349.90',
          stock: 24,
        }),
        expect.objectContaining({ name: 'Luminária de Mesa Arco', stock: 0 }),
      ]),
    );
  });

  it('rodar de novo não duplica nada', async () => {
    await seed(app.get(DataSource));

    const token = await login('admin@prateleira.com');
    const users = (
      await http()
        .get('/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;
    const products = (
      await http()
        .get('/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
    ).body;

    expect(users).toHaveLength(2);
    expect(products).toHaveLength(12);
  });
});
