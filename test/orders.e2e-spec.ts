import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { approvingGateway } from './helpers/gateway';
import { createUser, loginAs, TestUser } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let produtoA: { id: number }; // R$ 10,00
  let produtoB: { id: number }; // R$ 25,50

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const newCustomer = async (): Promise<{ user: TestUser; token: string }> => {
    const user = await createUser(app);
    return { user, token: await loginAs(app, user.email, user.password) };
  };

  const buy = async (token: string, items: object[], paymentMethod = 'pix') => {
    const cart = (
      await http().post('/cart').set(bearer(token)).send({ items }).expect(201)
    ).body;
    return (
      await http()
        .post('/payment')
        .set(bearer(token))
        .send({ paymentMethod, cartId: cart.id })
        .expect(201)
    ).body.order; // aprovado na hora: a Tentativa já virou Pedido
  };

  const listOrders = (token: string) =>
    http().get('/orders').set(bearer(token));

  beforeAll(async () => {
    app = await createTestApp({
      paymentGateway: approvingGateway(),
    });
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminToken = await loginAs(app, admin.email, admin.password);

    const createProduct = async (name: string, price: number) =>
      (
        await http()
          .post('/products')
          .set(bearer(adminToken))
          .send({ name, description: 'desc', price, stock: 50 })
          .expect(201)
      ).body;
    produtoA = await createProduct('Produto A', 10);
    produtoB = await createProduct('Produto B', 25.5);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação', async () => {
    await http().get('/orders').expect(401);
  });

  it.each([
    ['cliente', UserType.USER],
    ['moderador', UserType.MODERATOR],
  ])('nega acesso ao %s', async (_, role) => {
    const user = await createUser(app, { role });
    const token = await loginAs(app, user.email, user.password);

    await listOrders(token).expect(403);
  });

  it('carrinho pago aparece como Pedido para o administrador', async () => {
    const { user, token } = await newCustomer();
    const payment = await buy(
      token,
      [
        { productId: produtoA.id, quantity: 2 },
        { productId: produtoB.id, quantity: 1 },
      ],
      'credit_card',
    );

    const response = await listOrders(adminToken).expect(200);
    const order = response.body.find((o) => o.id === payment.id);

    expect(order).toMatchObject({
      id: payment.id,
      amount: '45.50',
      paymentMethod: 'credit_card',
      status: 'paid',
      gatewayReference: expect.stringMatching(/^PAG-TESTE-/),
      cartId: payment.cartId,
      customer: { id: user.id, email: user.email },
    });
    expect(order.createdAt).toEqual(expect.any(String));
    expect(order.items).toEqual(
      expect.arrayContaining([
        { productId: produtoA.id, name: 'Produto A', price: '10.00', quantity: 2 },
        { productId: produtoB.id, name: 'Produto B', price: '25.50', quantity: 1 },
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain('password');
  });

  it('lista do Pedido mais recente para o mais antigo', async () => {
    const { token } = await newCustomer();
    const primeiro = await buy(token, [{ productId: produtoA.id, quantity: 1 }]);
    const segundo = await buy(token, [{ productId: produtoB.id, quantity: 1 }]);

    const ids = (await listOrders(adminToken).expect(200)).body.map((o) => o.id);

    expect(ids.indexOf(segundo.id)).toBeLessThan(ids.indexOf(primeiro.id));
  });

  it('carrinho não pago não é Pedido', async () => {
    const { token } = await newCustomer();
    const cart = (
      await http()
        .post('/cart')
        .set(bearer(token))
        .send({ items: [{ productId: produtoA.id, quantity: 1 }] })
        .expect(201)
    ).body;

    const orders = (await listOrders(adminToken).expect(200)).body;

    expect(orders.some((o) => o.cartId === cart.id)).toBe(false);
  });
});
