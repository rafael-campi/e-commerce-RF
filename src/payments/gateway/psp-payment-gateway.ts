import { PspClient, PspError } from '../../psp/psp-client';
import {
  GatewayPayment,
  GatewayRefund,
  GatewayStatus,
  PaymentGateway,
  PaymentRequest,
} from './payment-gateway';

/** Pagamento como o PSP devolve em /v1/payments (payment-ledger-service). */
interface PspPayment {
  id: string;
  status: GatewayStatus | 'authorized' | 'refunded';
  pix: { copiaECola: string } | null;
  card: { brand: string; last4: string } | null;
  failure: { code: string } | null;
  expiresAt: string;
}

/**
 * Gateway sobre o PSP próprio (docs/adr/0001). O cartão chega tokenizado
 * pelo navegador (POST /v1/tokens do PSP, com a chave publicável): esta API
 * só repassa o token.
 */
export class PspPaymentGateway implements PaymentGateway {
  readonly requiresCardToken = true;

  constructor(private readonly psp: PspClient) {}

  async requestPayment(request: PaymentRequest): Promise<GatewayPayment> {
    return toGatewayPayment(
      await this.psp.request<PspPayment>('POST', '/v1/payments', {
        idempotencyKey: request.idempotencyKey,
        body: {
          amount: request.amountCents,
          currency: 'BRL',
          method: request.method,
          description: request.description,
          metadata: request.metadata,
          ...(request.card ? { card: request.card } : {}),
        },
      }),
    );
  }

  async getPayment(reference: string): Promise<GatewayPayment> {
    return toGatewayPayment(
      await this.psp.request<PspPayment>('GET', `/v1/payments/${reference}`),
    );
  }

  /** POST /v1/refunds do PSP; a taxa dele não volta (ADR 0006 do PSP). */
  async refundPayment(
    reference: string,
    idempotencyKey: string,
  ): Promise<GatewayRefund> {
    const refund = await this.psp.request<{
      id: string;
      status: GatewayRefund['status'];
      failureCode: string | null;
    }>('POST', '/v1/refunds', {
      idempotencyKey,
      body: { payment: reference },
    });
    return {
      reference: refund.id,
      status: refund.status,
      failureCode: refund.failureCode,
    };
  }

  async cancelPayment(reference: string): Promise<GatewayPayment> {
    try {
      return toGatewayPayment(
        await this.psp.request<PspPayment>(
          'POST',
          `/v1/payments/${reference}/cancel`,
          { idempotencyKey: `cancel-${reference}` },
        ),
      );
    } catch (error) {
      // pago (ou expirado) antes do cancelamento chegar: vale o estado final
      if (
        error instanceof PspError &&
        error.code === 'payments.not_cancelable'
      ) {
        return this.getPayment(reference);
      }
      throw error;
    }
  }
}

function toGatewayPayment(payment: PspPayment): GatewayPayment {
  return {
    reference: payment.id,
    // a loja sempre captura na hora: "authorized" só aparece se alguém
    // capturar depois pelo PSP, e até lá o dinheiro não está garantido.
    // "refunded" é um pagamento que deu certo e depois foi estornado.
    status:
      payment.status === 'authorized'
        ? 'pending'
        : payment.status === 'refunded'
          ? 'succeeded'
          : payment.status,
    pix: payment.pix ? { copiaECola: payment.pix.copiaECola } : null,
    card: payment.card
      ? { brand: payment.card.brand, last4: payment.card.last4 }
      : null,
    failureCode: payment.failure?.code ?? null,
    expiresAt: payment.expiresAt ? new Date(payment.expiresAt) : null,
  };
}
