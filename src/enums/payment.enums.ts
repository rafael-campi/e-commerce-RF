export enum PaymentStatus {
    INITIALIZE='initialized',
    PROGRESS='progress',
    FINALIZADO='finished',
    PAID='paid',
    // estorno pedido ao gateway, aguardando a resposta (o dinheiro ainda é da loja)
    REFUND_PENDING='refund_pending',
    REFUNDED='refunded',
}
  

export enum PaymentMethod {
  PIX = 'pix',
  CREDIT_CARD = 'credit_card',
}

/** Ciclo de vida de uma Tentativa de pagamento (ver CONTEXT.md). */
export enum PaymentAttemptStatus {
  PENDING = 'pending', // aguardando o cliente pagar (Pix) ou o gateway responder
  SUCCEEDED = 'succeeded', // virou Pedido
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
}
