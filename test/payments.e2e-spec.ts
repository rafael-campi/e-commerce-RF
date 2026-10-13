import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs, TestUser } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let produtoA: { id: number }; // R$ 10,00
  let produtoB: { id: number }; // R$ 25,50
  const gateway = { charge: jest.fn() };

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const newCustomer = async (): Promise<{ user: TestUser; token: string }> => {
    const user = await createUser(app);
    return { user, token: await loginAs(app, user.email, user.password) };
  };

  const newCart = async (
    token: string,
    items = [
      { productId: produtoA.id, quantity: 2 },
      { productId: produtoB.id, quantity: 1 },
    ],
  ) =>
    (await http().post('/cart').set(bearer(token)).send({ items }).expect(201))
      .body;

  const pay = (token: string, body: object) =>
    http().post('/payment').set(bearer(token)).send(body);

  beforeAll(async () => {
    app = await createTestApp({ paymentGateway: gateway });
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

  beforeEach(() => {
    gateway.charge.mockReset();
    gateway.charge.mockResolvedValue({ reference: 'ref-123' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação', async () => {
    await http().post('/payment').send({}).expect(401);
  });

  it('cobra a soma de preço × quantidade e registra o pagamento', async () => {
    const { user, token } = await newCustomer();
    const cart = await newCart(token);

    const response = await pay(token, {
      paymentMethod: 'pix',
      cartId: cart.id,
    }).expect(201);

    expect(response.body).toMatchObject({
      amount: '45.50',
      payment_method: 'pix',
      payment_status: 'progress',
      cartId: cart.id,
      userId: user.id,
    });
    expect(gateway.charge).toHaveBeenCalledTimes(1);
    expect(gateway.charge).toHaveBeenCalledWith({
      amount: '45.50',
      method: 'pix',
    });
  });

  it('aceita cartão de crédito', async () => {
    const { token } = await newCustomer();
    const cart = await newCart(token, [
      { productId: produtoB.id, quantity: 3 },
    ]);

    const response = await pay(token, {
      paymentMethod: 'credit_card',
      cartId: cart.id,
    }).expect(201);

    expect(response.body.amount).toBe('76.50');
  });

  it('rejeita método de pagamento não suportado', async () => {
    const { token } = await newCustomer();
    const cart = await newCart(token);

    await pay(token, { paymentMethod: 'boleto', cartId: cart.id }).expect(400);

    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('rejeita requisição sem cartId', async () => {
    const { token } = await newCustomer();

    await pay(token, { paymentMethod: 'pix' }).expect(400);
  });

  it('rejeita cartId fora do intervalo de inteiros', async () => {
    const { token } = await newCustomer();

    await pay(token, { paymentMethod: 'pix', cartId: 99999999999 }).expect(400);

    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('retorna 404 para carrinho inexistente', async () => {
    const { token } = await newCustomer();

    await pay(token, { paymentMethod: 'pix', cartId: 99999 }).expect(404);

    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('não permite pagar o carrinho de outro usuário', async () => {
    const dono = await newCustomer();
    const intruso = await newCustomer();
    const cart = await newCart(dono.token);

    await pay(intruso.token, { paymentMethod: 'pix', cartId: cart.id }).expect(
      404,
    );

    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('não cobra duas vezes o mesmo carrinho', async () => {
    const { token } = await newCustomer();
    const cart = await newCart(token);
    await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);

    await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(409);

    expect(gateway.charge).toHaveBeenCalledTimes(1);
  });

  it('retorna 502 quando o gateway falha e permite tentar de novo', async () => {
    const { token } = await newCustomer();
    const cart = await newCart(token);
    gateway.charge.mockRejectedValueOnce(new Error('gateway fora do ar'));

    await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(502);

    await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);
  });
});
