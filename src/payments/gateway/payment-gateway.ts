export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'canceled';

export interface PaymentRequest {
  amountCents: number;
  method: string;
  // a mesma chave devolve a mesma cobrança: retentar nunca cobra duas vezes
  idempotencyKey: string;
  description: string;
  metadata: Record<string, string>;
  // cartão: o token que o navegador obteve do gateway (a loja nunca vê o número)
  card?: { token: string; installments: number };
}

export interface GatewayPayment {
  reference: string;
  status: GatewayStatus;
  pix: { copiaECola: string } | null;
  card: { brand: string; last4: string } | null;
  // por que falhou (ex.: "insufficient_funds"); nulo se não falhou
  failureCode: string | null;
  expiresAt: Date | null;
}

export interface GatewayRefund {
  reference: string;
  status: 'pending' | 'succeeded' | 'failed';
  failureCode: string | null;
}

/**
 * O gateway pode aprovar na hora (status "succeeded") ou deixar o pagamento
 * pendente (Pix; cartão quando a operadora não responde): aí o resultado
 * chega depois, por webhook.
 */
export interface PaymentGateway {
  /** Se o cartão precisa vir tokenizado do navegador (`card.token`). */
  readonly requiresCardToken: boolean;
  requestPayment(request: PaymentRequest): Promise<GatewayPayment>;
  getPayment(reference: string): Promise<GatewayPayment>;
  /** Devolve o estado final: "canceled", ou "succeeded" se o cliente pagou antes. */
  cancelPayment(reference: string): Promise<GatewayPayment>;
  /** Estorna o valor inteiro de um pagamento. A mesma chave não estorna duas vezes. */
  refundPayment(
    reference: string,
    idempotencyKey: string,
  ): Promise<GatewayRefund>;
}
