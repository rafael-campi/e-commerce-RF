import * as request from 'supertest';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';
import { PspError } from '../src/psp/psp-client';

describe('Finance (e2e)', () => {
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function setup(pspClient?: { request: jest.Mock }) {
    const app = await createTestApp({ pspClient });
    const admin = await createUser(app, { role: UserType.ADMIN });
    const customer = await createUser(app);
    return {
      app,
      http: () => request(app.getHttpServer()),
      adminToken: await loginAs(app, admin.email, admin.password),
      customerToken: await loginAs(app, customer.email, customer.password),
    };
  }

  describe('sem PSP', () => {
    let ctx: Awaited<ReturnType<typeof setup>>;

    beforeAll(async () => {
      ctx = await setup();
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it('é só do administrador', async () => {
      await ctx.http().get('/admin/finance').expect(401);
      await ctx
        .http()
        .get('/admin/finance')
        .set(bearer(ctx.customerToken))
        .expect(403);
    });

    it('avisa que o financeiro não está disponível', async () => {
      const res = await ctx
        .http()
        .get('/admin/finance')
        .set(bearer(ctx.adminToken))
        .expect(200);

      expect(res.body).toEqual({ configured: false });
      await ctx
        .http()
        .post('/admin/finance/payouts')
        .set(bearer(ctx.adminToken))
        .set('Idempotency-Key', 'clique-12345678')
        .send({})
        .expect(503);
    });
  });

  describe('com PSP', () => {
    const psp = { request: jest.fn() };
    let ctx: Awaited<ReturnType<typeof setup>>;

    // respostas do PSP em centavos, por rota
    const responses: Record<string, unknown> = {
      'GET /v1/account': { payoutPixKey: '52998224725' },
      'GET /v1/balance': {
        available: [{ amount: 9901, currency: 'BRL' }],
        pending: [{ amount: 6466, currency: 'BRL' }],
      },
      'GET /v1/receivables?released=false&limit=100': [
        {
          paymentId: 'pay_1',
          installment: 2,
          amount: 3233,
          availableOn: '2026-12-20T12:00:00.000Z',
        },
        {
          paymentId: 'pay_1',
          installment: 3,
          amount: 0,
          availableOn: '2027-01-19T12:00:00.000Z',
        },
        {
          paymentId: 'pay_2',
          installment: 1,
          amount: 3233,
          availableOn: '2027-01-19T12:00:00.000Z',
        },
      ],
      'GET /v1/payouts?limit=20': [
        {
          id: 'po_1',
          amount: 5000,
          pixKey: '52998224725',
          status: 'paid',
          failureCode: null,
          createdAt: '2026-10-21T15:00:00.000Z',
        },
      ],
    };

    beforeAll(async () => {
      ctx = await setup(psp);
    });

    beforeEach(() => {
      psp.request.mockReset();
      psp.request.mockImplementation(async (method: string, path: string) => {
        const response = responses[`${method} ${path}`];
        if (response === undefined)
          throw new Error(`rota inesperada ${method} ${path}`);
        return response;
      });
    });

    afterAll(async () => {
      await ctx.app.close();
    });

    it('mostra saldo, agenda e repasses em reais', async () => {
      const res = await ctx
        .http()
        .get('/admin/finance')
        .set(bearer(ctx.adminToken))
        .expect(200);

      expect(res.body).toEqual({
        configured: true,
        payoutPixKey: '52998224725',
        available: 99.01,
        pending: 64.66,
        receivables: [
          {
            paymentId: 'pay_1',
            installment: 2,
            amount: 32.33,
            availableOn: '2026-12-20T12:00:00.000Z',
          },
          {
            paymentId: 'pay_2',
            installment: 1,
            amount: 32.33,
            availableOn: '2027-01-19T12:00:00.000Z',
          },
        ],
        payouts: [
          {
            id: 'po_1',
            amount: 50,
            pixKey: '52998224725',
            status: 'paid',
            failureCode: null,
            createdAt: '2026-10-21T15:00:00.000Z',
          },
        ],
      });
    });

    it('pede o repasse em centavos, com a chave de idempotência do clique', async () => {
      psp.request.mockResolvedValueOnce({
        id: 'po_2',
        amount: 2550,
        pixKey: '52998224725',
        status: 'paid',
        failureCode: null,
        createdAt: '2026-10-21T16:00:00.000Z',
      });

      const res = await ctx
        .http()
        .post('/admin/finance/payouts')
        .set(bearer(ctx.adminToken))
        .set('Idempotency-Key', 'clique-abcdef12')
        .send({ amount: 25.5 })
        .expect(201);

      expect(psp.request).toHaveBeenCalledWith('POST', '/v1/payouts', {
        idempotencyKey: 'admin-payout-clique-abcdef12',
        body: { amount: 2550 },
      });
      expect(res.body).toMatchObject({
        id: 'po_2',
        amount: 25.5,
        status: 'paid',
      });
    });

    it('exige a chave de idempotência', async () => {
      await ctx
        .http()
        .post('/admin/finance/payouts')
        .set(bearer(ctx.adminToken))
        .send({})
        .expect(400);
      expect(psp.request).not.toHaveBeenCalled();
    });

    it.each([
      [
        'settlement.insufficient_balance',
        422,
        'O saldo disponível não cobre esse valor.',
      ],
      [
        'settlement.no_payout_key',
        422,
        'Cadastre a chave Pix de repasse primeiro.',
      ],
      [undefined, 502, 'Não foi possível falar com o PSP.'],
    ])('explica a recusa %s', async (code, status, message) => {
      psp.request.mockRejectedValueOnce(new PspError(422, code, 'recusado'));

      const res = await ctx
        .http()
        .post('/admin/finance/payouts')
        .set(bearer(ctx.adminToken))
        .set(
          'Idempotency-Key',
          `clique-${status}-${(code ?? 'x').replace(/\W/g, '-')}`,
        )
        .send({})
        .expect(status);

      expect(res.body.message).toBe(message);
    });

    it('troca a chave Pix de repasse', async () => {
      psp.request.mockResolvedValueOnce({
        payoutPixKey: 'loja@prateleira.com.br',
      });

      const res = await ctx
        .http()
        .put('/admin/finance/payout-key')
        .set(bearer(ctx.adminToken))
        .send({ pixKey: 'Loja@Prateleira.com.br' })
        .expect(200);

      expect(psp.request).toHaveBeenCalledWith(
        'PATCH',
        '/v1/account',
        expect.objectContaining({
          body: { payoutPixKey: 'Loja@Prateleira.com.br' },
        }),
      );
      expect(res.body).toEqual({ payoutPixKey: 'loja@prateleira.com.br' });
    });

    it('explica uma chave Pix inválida', async () => {
      psp.request.mockRejectedValueOnce(
        new PspError(422, 'settlement.invalid_pix_key', 'inválida'),
      );

      const res = await ctx
        .http()
        .put('/admin/finance/payout-key')
        .set(bearer(ctx.adminToken))
        .send({ pixKey: '123' })
        .expect(422);

      expect(res.body.message).toMatch(/^Chave Pix inválida/);
    });
  });
});
