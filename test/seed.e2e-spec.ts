import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app';
import { seed } from '../src/database/seeds/seed';
import { seedDemo } from '../src/database/seeds/demo';
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

  describe('--demo', () => {
    const spDate = (offsetDays = 0) =>
      new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000)
        .toISOString()
        .slice(0, 10);

    const get = async (path: string) =>
      (
        await http()
          .get(path)
          .set('Authorization', `Bearer ${await login('admin@prateleira.com')}`)
          .expect(200)
      ).body;

    it('cria clientes e Pedidos pagos dos últimos 30 dias, sem mexer no estoque', async () => {
      const stockBefore = (await get('/products')).map((p) => p.stock);

      await seedDemo(app.get(DataSource));

      const orders = await get('/orders');
      expect(orders.length).toBeGreaterThan(50);
      const oldest = Date.now() - 31 * 86400_000;
      for (const o of orders) {
        expect(new Date(o.createdAt).getTime()).toBeGreaterThan(oldest);
        expect(new Date(o.createdAt).getTime()).toBeLessThanOrEqual(Date.now());
        expect(o.items.length).toBeGreaterThan(0);
      }
      expect((await get('/users')).length).toBeGreaterThan(2);
      expect((await get('/products')).map((p) => p.stock)).toEqual(stockBefore);

      const month = await get(
        `/admin/metrics?from=${spDate(-29)}&to=${spDate()}`,
      );
      expect(month.revenue).toBeGreaterThan(0);
      expect(month.byMethod.pix).toBeGreaterThan(0);
      expect(month.byMethod.credit_card).toBeGreaterThan(0);
    });

    it('rodar de novo não duplica os Pedidos', async () => {
      const before = (await get('/orders')).length;
      await seedDemo(app.get(DataSource));
      expect((await get('/orders')).length).toBe(before);
    });
  });
});
