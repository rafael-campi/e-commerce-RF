import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';
import { approvingGateway, deliverWebhook } from './helpers/gateway';
import { UserType } from '../src/enums/user-types.enum';
import { PspError } from '../src/psp/psp-client';
import { OrderRefundsService } from '../src/payments/order-refunds.service';

describe('Estorno de Pedido (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;
  const base = approvingGateway('PAG-ESTORNO');
  const gateway = { ...base, refundPayment: jest.fn() };

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const createProduct = async (stock: number, price = 20) =>
    (
      await http()
        .post('/products')
        .set(bearer(adminToken))
        .send({
          name: `Produto estorno ${Math.random()}`,
          description: 'desc',
          price,
          stock,
        })
        .expect(201)
    ).body;

  const stockOf = async (id: number) =>
    (await http().get(`/products/${id}`).set(bearer(adminToken)).expect(200))
      .body.stock;

  /** Um Pedido pago de `quantity` unidades de um produto novo. */
  async function paidOrder(quantity = 2) {
    const product = await createProduct(10);
    const cart = (
      await http()
        .post('/cart')
        .set(bearer(customerToken))
        .send({ items: [{ productId: product.id, quantity }] })
        .expect(201)
    ).body;
    const attempt = (
      await http()
        .post('/payment')
        .set(bearer(customerToken))
        .send({ paymentMethod: 'pix', cartId: cart.id })
        .expect(201)
    ).body;
    return { product, order: attempt.order };
  }

  const refund = (orderId: number, token = adminToken) =>
    http().post(`/orders/${orderId}/refund`).set(bearer(token));

  const orderById = async (id: number) =>
    (await http().get('/orders').set(bearer(adminToken)).expect(200)).body.find(
      (o) => o.id === id,
    );

  beforeAll(async () => {
    app = await createTestApp({ paymentGateway: gateway });
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminToken = await loginAs(app, admin.email, admin.password);
    const customer = await createUser(app);
    customerToken = await loginAs(app, customer.email, customer.password);
  });

  beforeEach(() => {
    gateway.refundPayment.mockReset();
    gateway.refundPayment.mockImplementation(async (reference: string) => ({
      reference: `re_${reference}`,
      status: 'succeeded',
      failureCode: null,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('é só do administrador', async () => {
    const { order } = await paidOrder();

    await http().post(`/orders/${order.id}/refund`).expect(401);
    await refund(order.id, customerToken).expect(403);
  });

  it('estorna o Pedido inteiro e devolve os itens ao estoque, uma vez só', async () => {
    const { product, order } = await paidOrder(3);
    expect(await stockOf(product.id)).toBe(7);

    const res = await refund(order.id).expect(200);
    const again = await refund(order.id).expect(200);

    expect(res.body).toMatchObject({ id: order.id, status: 'refunded' });
    expect(res.body.refundedAt).toEqual(expect.any(String));
    expect(again.body.status).toBe('refunded');
    expect(gateway.refundPayment).toHaveBeenCalledTimes(1);
    expect(gateway.refundPayment).toHaveBeenCalledWith(
      order.gatewayReference,
      `order-${order.id}-refund`,
    );
    expect(await stockOf(product.id)).toBe(10);
  });

  it('retorna 404 para pedido inexistente', async () => {
    await refund(999999).expect(404);
  });

  describe('quando o gateway decide depois', () => {
    const pending = async (reference: string) => ({
      reference: `re_${reference}`,
      status: 'pending',
      failureCode: null,
    });

    it('fica "estornando" até o webhook confirmar', async () => {
      const { product, order } = await paidOrder(2);
      gateway.refundPayment.mockImplementationOnce(pending);

      const res = await refund(order.id).expect(200);
      expect(res.body.status).toBe('refund_pending');
      expect(await stockOf(product.id)).toBe(8);

      await deliverWebhook(app, `re_${order.gatewayReference}`, 'succeeded', {
        type: 'refund.succeeded',
        object: { paymentId: order.gatewayReference },
      }).expect(200);

      expect((await orderById(order.id)).status).toBe('refunded');
      expect(await stockOf(product.id)).toBe(10);
    });

    it('volta a "pago" se o webhook disser que falhou', async () => {
      const { product, order } = await paidOrder(2);
      gateway.refundPayment.mockImplementationOnce(pending);
      await refund(order.id).expect(200);

      await deliverWebhook(app, `re_${order.gatewayReference}`, 'failed', {
        type: 'refund.failed',
        object: { paymentId: order.gatewayReference },
      }).expect(200);

      expect((await orderById(order.id)).status).toBe('paid');
      expect(await stockOf(product.id)).toBe(8);
    });

    it('pede de novo, com a mesma chave, o estorno que ficou sem resposta', async () => {
      const { order } = await paidOrder();
      gateway.refundPayment.mockRejectedValueOnce(new Error('timeout'));

      const res = await refund(order.id).expect(200);
      expect(res.body.status).toBe('refund_pending');

      await app
        .get(OrderRefundsService)
        .retryStale(new Date(Date.now() + 6 * 60_000));

      expect((await orderById(order.id)).status).toBe('refunded');
      expect(gateway.refundPayment).toHaveBeenNthCalledWith(
        2,
        order.gatewayReference,
        `order-${order.id}-refund`,
      );
    });
  });

  describe('recusas', () => {
    it.each([
      [
        new PspError(422, 'refunds.payment_not_refundable', 'x'),
        409,
        'O pagamento deste pedido não pode mais ser estornado.',
      ],
      [
        new PspError(404, 'payments.not_found', 'x'),
        422,
        'Este pedido não foi pago pelo PSP (ex.: pedido de demonstração) e não pode ser estornado por aqui.',
      ],
    ])(
      'explica a recusa e mantém o pedido pago',
      async (error, status, message) => {
        const { product, order } = await paidOrder(2);
        gateway.refundPayment.mockRejectedValueOnce(error);

        const res = await refund(order.id).expect(status);

        expect(res.body.message).toBe(message);
        expect((await orderById(order.id)).status).toBe('paid');
        expect(await stockOf(product.id)).toBe(8);
      },
    );

    it('mantém o pedido pago quando o gateway responde que falhou', async () => {
      const { order } = await paidOrder();
      gateway.refundPayment.mockResolvedValueOnce({
        reference: 're_x',
        status: 'failed',
        failureCode: 'chargeback_in_progress',
      });

      const res = await refund(order.id).expect(422);

      expect(res.body.message).toMatch(/chargeback_in_progress/);
      expect((await orderById(order.id)).status).toBe('paid');
    });
  });

  it('tira o pedido estornado da receita do dashboard', async () => {
    const today = new Date(Date.now() - 3 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const metrics = async () =>
      (
        await http()
          .get('/admin/metrics')
          .query({ from: today, to: today })
          .set(bearer(adminToken))
          .expect(200)
      ).body;
    const before = await metrics();
    const { order } = await paidOrder(1); // R$ 20,00

    const withOrder = await metrics();
    await refund(order.id).expect(200);
    const after = await metrics();

    expect(withOrder.paidOrders).toBe(before.paidOrders + 1);
    expect(withOrder.revenue).toBeCloseTo(before.revenue + 20, 2);
    expect(after.paidOrders).toBe(before.paidOrders);
    expect(after.revenue).toBeCloseTo(before.revenue, 2);
  });
});
