import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app';
import { approvingGateway } from './helpers/gateway';
import { createUser, loginAs } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';
import { PaymentEntity } from '../src/payments/entities/payment.entity';

// Datas do dashboard são dias de São Paulo (UTC-3, sem horário de verão desde 2019).
const spDate = (offsetDays = 0) =>
  new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000)
    .toISOString()
    .slice(0, 10);

describe('Admin metrics (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let fone: { id: number }; // R$ 100,00
  let caneca: { id: number }; // R$ 20,50
  let customerToken: string;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const metrics = (from: string, to: string, token = adminToken) =>
    http().get('/admin/metrics').query({ from, to }).set(bearer(token));

  const buy = async (items: object[], paymentMethod: string) => {
    const cart = (
      await http()
        .post('/cart')
        .set(bearer(customerToken))
        .send({ items })
        .expect(201)
    ).body;
    return (
      await http()
        .post('/payment')
        .set(bearer(customerToken))
        .send({ paymentMethod, cartId: cart.id })
        .expect(201)
    ).body.order; // aprovado na hora: a Tentativa já virou Pedido
  };

  beforeAll(async () => {
    app = await createTestApp({
      paymentGateway: approvingGateway(),
    });
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminToken = await loginAs(app, admin.email, admin.password);
    const customer = await createUser(app);
    customerToken = await loginAs(app, customer.email, customer.password);

    const createProduct = async (name: string, price: number) =>
      (
        await http()
          .post('/products')
          .set(bearer(adminToken))
          .send({ name, description: 'desc', price, stock: 50 })
          .expect(201)
      ).body;
    fone = await createProduct('Fone', 100);
    caneca = await createProduct('Caneca', 20.5);

    // hoje: 2 Pedidos (Pix R$ 241,00 e cartão R$ 100,00) e 1 carrinho aberto
    await buy(
      [
        { productId: fone.id, quantity: 2 },
        { productId: caneca.id, quantity: 2 },
      ],
      'pix',
    );
    await buy([{ productId: fone.id, quantity: 1 }], 'credit_card');
    await http()
      .post('/cart')
      .set(bearer(customerToken))
      .send({ items: [{ productId: caneca.id, quantity: 1 }] })
      .expect(201);

    // um Pedido de 3 dias atrás (R$ 20,50), para o período anterior
    const old = await buy([{ productId: caneca.id, quantity: 1 }], 'pix');
    await app
      .get(DataSource)
      .getRepository(PaymentEntity)
      .update(old.id, {
        createdAt: new Date(Date.now() - 3 * 86400_000),
      });
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação e papel ADMIN', async () => {
    await http()
      .get('/admin/metrics')
      .query({ from: spDate(), to: spDate() })
      .expect(401);
    await metrics(spDate(), spDate(), customerToken).expect(403);
  });

  it.each([
    ['sem datas', {}],
    ['data inválida', { from: '2026-13-40', to: '2026-10-21' }],
    ['formato errado', { from: '21/10/2026', to: '21/10/2026' }],
    ['início depois do fim', { from: '2026-10-21', to: '2026-10-20' }],
    ['mais de 60 dias', { from: '2026-01-01', to: '2026-10-21' }],
  ])('rejeita %s com 400', async (_nome, query) => {
    await http()
      .get('/admin/metrics')
      .query(query)
      .set(bearer(adminToken))
      .expect(400);
  });

  it('resume o dia de hoje em faixas de 2 horas', async () => {
    const body = (await metrics(spDate(), spDate()).expect(200)).body;

    expect(body).toMatchObject({
      from: spDate(),
      to: spDate(),
      granularity: '2h',
      revenue: 341,
      paidOrders: 2,
      averageTicket: 170.5,
      openCarts: 1,
      byMethod: { pix: 1, credit_card: 1 },
    });
    expect(body.newUsers).toBeGreaterThanOrEqual(2);
    expect(body.series).toHaveLength(12);
    const sum = (k: string) => body.series.reduce((s, b) => s + b[k], 0);
    expect(sum('revenue')).toBeCloseTo(341);
    expect(sum('orders')).toBe(2);
    expect(body.topProducts).toEqual([
      { productId: fone.id, name: 'Fone', units: 3, revenue: 300 },
      { productId: caneca.id, name: 'Caneca', units: 2, revenue: 41 },
    ]);
  });

  it('compara com o período anterior de mesmo tamanho', async () => {
    // 7 dias até hoje × os 7 dias antes disso: o Pedido de 3 dias atrás fica no atual
    const week = (await metrics(spDate(-6), spDate()).expect(200)).body;
    expect(week.granularity).toBe('day');
    expect(week.series).toHaveLength(7);
    expect(week.revenue).toBeCloseTo(361.5);
    expect(week.paidOrders).toBe(3);

    // só hoje × só ontem: nenhum Pedido ontem
    const today = (await metrics(spDate(), spDate()).expect(200)).body;
    expect(today.previous).toMatchObject({ revenue: 0, paidOrders: 0 });

    // os 3 dias de hoje até 2 dias atrás × os 3 anteriores: o Pedido antigo é o "anterior"
    const recent = (await metrics(spDate(-2), spDate()).expect(200)).body;
    expect(recent.previous).toMatchObject({ revenue: 20.5, paidOrders: 1 });
  });

  it('período sem vendas vem zerado, mas carrinhos abertos são o estado atual', async () => {
    const body = (await metrics(spDate(-20), spDate(-10)).expect(200)).body;

    expect(body).toMatchObject({
      revenue: 0,
      paidOrders: 0,
      averageTicket: 0,
      openCarts: 1,
      byMethod: { pix: 0, credit_card: 0 },
      topProducts: [],
    });
    expect(body.series).toHaveLength(11);
  });
});
