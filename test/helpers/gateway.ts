import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import * as request from 'supertest';
import {
  GatewayPayment,
  GatewayStatus,
  PaymentGateway,
} from '../../src/payments/gateway/payment-gateway';

let sequence = 0;

/** Aprova tudo na hora, com uma referência nova a cada cobrança. */
export function approvingGateway(prefix = 'PAG-TESTE'): PaymentGateway {
  const approved = (reference: string): GatewayPayment => ({
    reference,
    status: 'succeeded',
    pix: null,
    card: null,
    failureCode: null,
    expiresAt: null,
  });
  return {
    requiresCardToken: false,
    requestPayment: async () => approved(`${prefix}-${++sequence}`),
    getPayment: async (reference) => approved(reference),
    cancelPayment: async (reference) => approved(reference),
    refundPayment: async (reference) => ({
      reference: `refund-${reference}`,
      status: 'succeeded',
      failureCode: null,
    }),
  };
}

/** Um Pix pendente, como o PSP devolve ao criar a cobrança. */
export function pendingPix(
  reference = `pay_test_${++sequence}`,
): GatewayPayment {
  return {
    reference,
    status: 'pending',
    pix: { copiaECola: `00020101021226…${reference}` },
    card: null,
    failureCode: null,
    expiresAt: new Date(Date.now() + 3600_000),
  };
}

let eventSequence = 0;

/** Entrega um evento do PSP em /webhooks/payments, assinado como o PSP assina. */
export function deliverWebhook(
  app: INestApplication,
  reference: string,
  status: GatewayStatus,
  options: {
    eventId?: string;
    secret?: string;
    type?: string;
    object?: Record<string, unknown>; // campos extras (ex.: paymentId de um estorno)
  } = {},
) {
  const body = JSON.stringify({
    id: options.eventId ?? `evt_test_${++eventSequence}`,
    type: options.type ?? `payment.${status}`,
    createdAt: new Date().toISOString(),
    data: { object: { id: reference, status, ...options.object } },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac(
    'sha256',
    options.secret ?? process.env.PSP_WEBHOOK_SECRET!,
  )
    .update(`${t}.${body}`)
    .digest('hex');

  return request(app.getHttpServer())
    .post('/webhooks/payments')
    .set('Content-Type', 'application/json')
    .set('PSP-Signature', `t=${t},v1=${v1}`)
    .send(body);
}
