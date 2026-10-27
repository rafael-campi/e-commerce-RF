import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app';
import { createUser, loginAs, TestUser } from './helpers/users';
import { deliverWebhook, pendingPix } from './helpers/gateway';
import { UserType } from '../src/enums/user-types.enum';
import { PaymentsService } from '../src/payments/payments.service';
import { GatewayPayment } from '../src/payments/gateway/payment-gateway';
import { PaymentAttemptEntity } from '../src/payments/entities/payment-attempt.entity';

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let produtoA: { id: number }; // R$ 10,00
  let produtoB: { id: number }; // R$ 25,50
  const gateway = {
    requiresCardToken: false, // true imita o PSP: cartão só com token
    requestPayment: jest.fn(),
    getPayment: jest.fn(),
    cancelPayment: jest.fn(),
    refundPayment: jest.fn(),
  };

  let referenceSequence = 0;
  const approved = (): GatewayPayment => ({
    reference: `ref-${++referenceSequence}`,
    status: 'succeeded',
    pix: null,
    card: null,
    failureCode: null,
    expiresAt: null,
  });

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

  const createLimited = async (stock: number) =>
    (
      await http()
        .post('/products')
        .set(bearer(adminToken))
        .send({
          name: `Limitado ${stock}-${Math.random()}`,
          description: 'desc',
          price: 5,
          stock,
        })
        .expect(201)
    ).body;

  const stockOf = async (id: number) =>
    (await http().get(`/products/${id}`).set(bearer(adminToken)).expect(200))
      .body.stock;

  const orders = async () =>
    (await http().get('/orders').set(bearer(adminToken)).expect(200)).body;

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
    gateway.requiresCardToken = false;
    gateway.requestPayment.mockReset();
    gateway.getPayment.mockReset();
    gateway.cancelPayment.mockReset();
    gateway.requestPayment.mockImplementation(async () => approved());
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação', async () => {
    await http().post('/payment').send({}).expect(401);
  });

  describe('aprovado na hora', () => {
    it('cobra a soma de preço × quantidade e cria o Pedido', async () => {
      const { user, token } = await newCustomer();
      const cart = await newCart(token);

      const response = await pay(token, {
        paymentMethod: 'credit_card',
        cartId: cart.id,
      }).expect(201);

      expect(response.body).toMatchObject({
        cartId: cart.id,
        status: 'succeeded',
        method: 'credit_card',
        amount: '45.50',
        pix: null,
        order: {
          amount: '45.50',
          payment_method: 'credit_card',
          payment_status: 'paid',
          cartId: cart.id,
          userId: user.id,
        },
      });
      expect(gateway.requestPayment).toHaveBeenCalledTimes(1);
      expect(gateway.requestPayment).toHaveBeenCalledWith({
        amountCents: 4550,
        method: 'credit_card',
        idempotencyKey: `cart-${cart.id}-attempt-${response.body.id}`,
        description: `Loja Prateleira · Carrinho #${cart.id}`,
        metadata: {
          cartId: String(cart.id),
          attemptId: String(response.body.id),
        },
      });
    });

    it('baixa o estoque dos itens pagos', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(10);
      const cart = await newCart(token, [
        { productId: product.id, quantity: 4 },
      ]);

      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);

      expect(await stockOf(product.id)).toBe(6);
    });

    it('não cobra duas vezes o mesmo carrinho', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);
      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);

      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(409);

      expect(gateway.requestPayment).toHaveBeenCalledTimes(1);
    });
  });

  describe('validação', () => {
    it('rejeita método de pagamento não suportado', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await pay(token, { paymentMethod: 'boleto', cartId: cart.id }).expect(
        400,
      );

      expect(gateway.requestPayment).not.toHaveBeenCalled();
    });

    it('rejeita requisição sem cartId', async () => {
      const { token } = await newCustomer();

      await pay(token, { paymentMethod: 'pix' }).expect(400);
    });

    it('rejeita cartId fora do intervalo de inteiros', async () => {
      const { token } = await newCustomer();

      await pay(token, { paymentMethod: 'pix', cartId: 99999999999 }).expect(
        400,
      );

      expect(gateway.requestPayment).not.toHaveBeenCalled();
    });

    it('retorna 404 para carrinho inexistente', async () => {
      const { token } = await newCustomer();

      await pay(token, { paymentMethod: 'pix', cartId: 99999 }).expect(404);

      expect(gateway.requestPayment).not.toHaveBeenCalled();
    });

    it('não permite pagar o carrinho de outro usuário', async () => {
      const dono = await newCustomer();
      const intruso = await newCustomer();
      const cart = await newCart(dono.token);

      await pay(intruso.token, {
        paymentMethod: 'pix',
        cartId: cart.id,
      }).expect(404);

      expect(gateway.requestPayment).not.toHaveBeenCalled();
    });
  });

  describe('falhas do gateway', () => {
    it('recusa pagar quando o estoque acabou depois da criação do carrinho', async () => {
      const first = await newCustomer();
      const second = await newCustomer();
      const product = await createLimited(5);
      const items = [{ productId: product.id, quantity: 3 }];
      const firstCart = await newCart(first.token, items);
      const secondCart = await newCart(second.token, items);

      await pay(first.token, {
        paymentMethod: 'pix',
        cartId: firstCart.id,
      }).expect(201);
      gateway.requestPayment.mockClear();

      await pay(second.token, {
        paymentMethod: 'pix',
        cartId: secondCart.id,
      }).expect(409);

      expect(gateway.requestPayment).not.toHaveBeenCalled();
      expect(await stockOf(product.id)).toBe(2);
    });

    it('retorna 502, devolve o estoque e permite tentar de novo', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(5);
      const cart = await newCart(token, [
        { productId: product.id, quantity: 3 },
      ]);
      gateway.requestPayment.mockRejectedValueOnce(
        new Error('gateway fora do ar'),
      );

      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(502);
      expect(await stockOf(product.id)).toBe(5);

      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);
      expect(await stockOf(product.id)).toBe(2);
    });

    it('retorna 402 e devolve o estoque quando o pagamento é recusado', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(5);
      const cart = await newCart(token, [
        { productId: product.id, quantity: 2 },
      ]);
      gateway.requestPayment.mockResolvedValueOnce({
        ...approved(),
        status: 'failed',
      });

      await pay(token, {
        paymentMethod: 'credit_card',
        cartId: cart.id,
      }).expect(402);

      expect(await stockOf(product.id)).toBe(5);
    });
  });

  describe('Pix pendente', () => {
    const startPix = async (stock = 10, quantity = 2) => {
      const { user, token } = await newCustomer();
      const product = await createLimited(stock);
      const cart = await newCart(token, [{ productId: product.id, quantity }]);
      const charge = pendingPix();
      gateway.requestPayment.mockResolvedValueOnce(charge);

      const attempt = (
        await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201)
      ).body;
      return { user, token, product, cart, charge, attempt };
    };

    it('devolve o copia e cola, reserva o estoque e não cria Pedido ainda', async () => {
      const { product, charge, attempt } = await startPix(10, 2);

      expect(attempt).toMatchObject({
        status: 'pending',
        method: 'pix',
        amount: '10.00',
        pix: { copiaECola: charge.pix!.copiaECola },
        order: null,
      });
      expect(new Date(attempt.expiresAt).getTime()).toBe(
        charge.expiresAt!.getTime(),
      );
      expect(await stockOf(product.id)).toBe(8);
      expect(
        (await orders()).some((o) => o.gatewayReference === charge.reference),
      ).toBe(false);
    });

    it('trava o carrinho enquanto o Pix está pendente', async () => {
      const { token, product, cart } = await startPix();

      await http()
        .put(`/cart/${cart.id}/items/${product.id}`)
        .set(bearer(token))
        .send({ quantity: 1 })
        .expect(409);
      await http().delete(`/cart/${cart.id}`).set(bearer(token)).expect(409);
    });

    it('retoma a mesma Tentativa se o cliente pedir de novo', async () => {
      const { token, cart, attempt } = await startPix();

      const again = await pay(token, {
        paymentMethod: 'pix',
        cartId: cart.id,
      }).expect(201);

      expect(again.body).toEqual(attempt);
      expect(gateway.requestPayment).toHaveBeenCalledTimes(1);
    });

    it('recusa trocar de método com um Pix pendente', async () => {
      const { token, cart } = await startPix();

      await pay(token, {
        paymentMethod: 'credit_card',
        cartId: cart.id,
      }).expect(409);
    });

    it('vira Pedido quando o webhook confirma, uma vez só', async () => {
      const { token, product, charge, attempt } = await startPix(10, 2);

      await deliverWebhook(app, charge.reference, 'succeeded', {
        eventId: `evt-${charge.reference}`,
      }).expect(200);
      await deliverWebhook(app, charge.reference, 'succeeded', {
        eventId: `evt-${charge.reference}`,
      }).expect(200);
      await deliverWebhook(app, charge.reference, 'succeeded').expect(200); // outro id, mesmo fato

      const after = (
        await http()
          .get(`/payment/attempts/${attempt.id}`)
          .set(bearer(token))
          .expect(200)
      ).body;
      expect(after.status).toBe('succeeded');
      expect(after.order).toMatchObject({
        amount: '10.00',
        payment_method: 'pix',
        gatewayReference: charge.reference,
      });
      expect(
        (await orders()).filter((o) => o.gatewayReference === charge.reference),
      ).toHaveLength(1);
      expect(await stockOf(product.id)).toBe(8);
    });

    it.each(['expired', 'canceled', 'failed'] as const)(
      'devolve o estoque e libera o carrinho quando o webhook diz %s',
      async (status) => {
        const { token, product, cart, charge, attempt } = await startPix(10, 2);

        await deliverWebhook(app, charge.reference, status).expect(200);

        const after = (
          await http()
            .get(`/payment/attempts/${attempt.id}`)
            .set(bearer(token))
            .expect(200)
        ).body;
        expect(after.status).toBe(status);
        expect(await stockOf(product.id)).toBe(10);
        await http()
          .put(`/cart/${cart.id}/items/${product.id}`)
          .set(bearer(token))
          .send({ quantity: 1 })
          .expect(200);
      },
    );

    it('ignora um webhook que chega depois do fim, sem mexer no estoque', async () => {
      const { product, charge } = await startPix(10, 2);
      await deliverWebhook(app, charge.reference, 'expired').expect(200);

      await deliverWebhook(app, charge.reference, 'succeeded').expect(200);

      expect(await stockOf(product.id)).toBe(10);
      expect(
        (await orders()).some((o) => o.gatewayReference === charge.reference),
      ).toBe(false);
    });

    it('cancela a pedido do cliente e devolve o estoque', async () => {
      const { token, product, charge, attempt } = await startPix(10, 2);
      gateway.cancelPayment.mockResolvedValueOnce({
        ...charge,
        status: 'canceled',
      });

      const res = await http()
        .post(`/payment/attempts/${attempt.id}/cancel`)
        .set(bearer(token))
        .expect(200);

      expect(gateway.cancelPayment).toHaveBeenCalledWith(charge.reference);
      expect(res.body.status).toBe('canceled');
      expect(await stockOf(product.id)).toBe(10);
    });

    it('vira Pedido se o cliente pagou antes do cancelamento chegar', async () => {
      const { token, charge, attempt } = await startPix();
      gateway.cancelPayment.mockResolvedValueOnce({
        ...charge,
        status: 'succeeded',
      });

      const res = await http()
        .post(`/payment/attempts/${attempt.id}/cancel`)
        .set(bearer(token))
        .expect(200);

      expect(res.body.status).toBe('succeeded');
      expect(res.body.order).not.toBeNull();
    });

    it('não mostra a Tentativa de outro cliente', async () => {
      const { attempt } = await startPix();
      const intruso = await newCustomer();

      await http()
        .get(`/payment/attempts/${attempt.id}`)
        .set(bearer(intruso.token))
        .expect(404);
      await http()
        .post(`/payment/attempts/${attempt.id}/cancel`)
        .set(bearer(intruso.token))
        .expect(404);
    });
  });

  describe('POST /webhooks/payments', () => {
    it('recusa entregas sem assinatura válida e não muda nada', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);
      const charge = pendingPix();
      gateway.requestPayment.mockResolvedValueOnce(charge);
      await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201);

      await deliverWebhook(app, charge.reference, 'succeeded', {
        secret: 'whsec_de_outro',
      }).expect(401);
      await http()
        .post('/webhooks/payments')
        .send({
          id: 'evt',
          type: 'payment.succeeded',
          data: { object: { id: charge.reference, status: 'succeeded' } },
        })
        .expect(401);

      expect(
        (await orders()).some((o) => o.gatewayReference === charge.reference),
      ).toBe(false);
    });

    it('aceita e ignora evento de pagamento desconhecido', async () => {
      await deliverWebhook(app, 'pay_que_nao_existe', 'succeeded').expect(200);
    });

    it('ignora eventos que não são de pagamento, mesmo com o id de um pagamento', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);
      const charge = pendingPix();
      gateway.requestPayment.mockResolvedValueOnce(charge);
      const attempt = (
        await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201)
      ).body;

      await deliverWebhook(app, charge.reference, 'succeeded', {
        type: 'refund.succeeded',
      }).expect(200);

      const after = (
        await http()
          .get(`/payment/attempts/${attempt.id}`)
          .set(bearer(token))
          .expect(200)
      ).body;
      expect(after.status).toBe('pending');
    });
  });

  describe('reconciliação', () => {
    it('confere no gateway o Pix vencido cujo webhook se perdeu', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(10);
      const cart = await newCart(token, [
        { productId: product.id, quantity: 3 },
      ]);
      const charge = {
        ...pendingPix(),
        expiresAt: new Date(Date.now() - 10 * 60_000),
      };
      gateway.requestPayment.mockResolvedValueOnce(charge);
      const attempt = (
        await pay(token, { paymentMethod: 'pix', cartId: cart.id }).expect(201)
      ).body;
      gateway.getPayment.mockResolvedValue({ ...charge, status: 'expired' });

      await app.get(PaymentsService).reconcile();

      expect(gateway.getPayment).toHaveBeenCalledWith(charge.reference);
      const after = (
        await http()
          .get(`/payment/attempts/${attempt.id}`)
          .set(bearer(token))
          .expect(200)
      ).body;
      expect(after.status).toBe('expired');
      expect(await stockOf(product.id)).toBe(10);
    });

    it('encerra a Tentativa que nunca chegou ao gateway', async () => {
      const { user, token } = await newCustomer();
      const product = await createLimited(10);
      const cart = await newCart(token, [
        { productId: product.id, quantity: 3 },
      ]);
      // o processo "caiu" entre reservar o Estoque e chamar o gateway
      const db = app.get(DataSource);
      await db.query(`UPDATE products SET stock = stock - 3 WHERE id = $1`, [
        product.id,
      ]);
      await db.getRepository(PaymentAttemptEntity).save({
        cart: { id: cart.id },
        user: { id: user.id },
        method: 'pix',
        amountCents: 1500,
        status: 'pending',
      });

      await app
        .get(PaymentsService)
        .reconcile(new Date(Date.now() + 3 * 60_000));

      expect(await stockOf(product.id)).toBe(10);
      const [row] = await db.query(
        `SELECT status FROM payment_attempts WHERE "cartId" = $1`,
        [cart.id],
      );
      expect(row.status).toBe('failed');
      expect(gateway.getPayment).not.toHaveBeenCalled();
    });
  });

  describe('cartão pelo PSP', () => {
    const token = `tok_${'a'.repeat(24)}`;

    beforeEach(() => {
      gateway.requiresCardToken = true;
    });

    it('exige o token do cartão, sem abrir Tentativa', async () => {
      const { token: jwt } = await newCustomer();
      const product = await createLimited(5);
      const cart = await newCart(jwt, [{ productId: product.id, quantity: 1 }]);

      const res = await pay(jwt, {
        paymentMethod: 'credit_card',
        cartId: cart.id,
      }).expect(400);

      expect(res.body.message).toBe('Informe os dados do cartão.');
      expect(gateway.requestPayment).not.toHaveBeenCalled();
      expect(await stockOf(product.id)).toBe(5);
    });

    it('repassa o token e as parcelas, e guarda só bandeira e final', async () => {
      const { token: jwt } = await newCustomer();
      const cart = await newCart(jwt);
      gateway.requestPayment.mockResolvedValueOnce({
        ...approved(),
        card: { brand: 'visa', last4: '4242' },
      });

      const res = await pay(jwt, {
        paymentMethod: 'credit_card',
        cartId: cart.id,
        cardToken: token,
        installments: 3,
      }).expect(201);

      expect(gateway.requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ card: { token, installments: 3 } }),
      );
      expect(res.body).toMatchObject({
        status: 'succeeded',
        card: { brand: 'visa', last4: '4242' },
        failure: null,
      });
    });

    it.each([
      ['insufficient_funds', 'O cartão não tem saldo ou limite suficiente.'],
      ['card_declined', 'O banco emissor recusou o cartão.'],
      ['codigo_novo', 'O pagamento foi recusado.'],
    ])(
      'explica a recusa %s e devolve o estoque',
      async (failureCode, message) => {
        const { token: jwt } = await newCustomer();
        const product = await createLimited(5);
        const cart = await newCart(jwt, [
          { productId: product.id, quantity: 2 },
        ]);
        gateway.requestPayment.mockResolvedValueOnce({
          ...approved(),
          status: 'failed',
          failureCode,
        });

        const res = await pay(jwt, {
          paymentMethod: 'credit_card',
          cartId: cart.id,
          cardToken: token,
        }).expect(402);

        expect(res.body.message).toBe(message);
        expect(await stockOf(product.id)).toBe(5);
      },
    );

    it('espera o webhook quando a operadora não respondeu', async () => {
      const { token: jwt } = await newCustomer();
      const cart = await newCart(jwt);
      const reference = `pay_card_${++referenceSequence}`;
      gateway.requestPayment.mockResolvedValueOnce({
        ...approved(),
        reference,
        status: 'pending',
      });

      const attempt = (
        await pay(jwt, {
          paymentMethod: 'credit_card',
          cartId: cart.id,
          cardToken: token,
        }).expect(201)
      ).body;
      expect(attempt).toMatchObject({ status: 'pending', pix: null });

      await deliverWebhook(app, reference, 'succeeded').expect(200);

      const after = (
        await http()
          .get(`/payment/attempts/${attempt.id}`)
          .set(bearer(jwt))
          .expect(200)
      ).body;
      expect(after.status).toBe('succeeded');
    });
  });

  describe('GET /payment/config', () => {
    afterEach(() => {
      delete process.env.PSP_PUBLISHABLE_KEY;
    });

    it('não pede cartão com o gateway local', async () => {
      const { token } = await newCustomer();

      const res = await http()
        .get('/payment/config')
        .set(bearer(token))
        .expect(200);

      expect(res.body).toEqual({ card: null });
    });

    it('entrega a chave publicável do PSP para tokenizar no navegador', async () => {
      gateway.requiresCardToken = true;
      process.env.PSP_PUBLISHABLE_KEY = 'pk_test_abc';
      const { token } = await newCustomer();

      const res = await http()
        .get('/payment/config')
        .set(bearer(token))
        .expect(200);

      expect(res.body).toEqual({
        card: { publishableKey: 'pk_test_abc', pspUrl: '/psp' },
      });
    });

    it('exige login', async () => {
      await http().get('/payment/config').expect(401);
    });
  });
});
