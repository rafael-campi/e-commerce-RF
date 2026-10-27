// Formatos devolvidos pela API NestJS (ver README da raiz). Termos de domínio em CONTEXT.md.

export const ROLE = { ADMIN: 1, MODERATOR: 2, USER: 3 } as const;
export type RoleId = (typeof ROLE)[keyof typeof ROLE];
export type RoleName = keyof typeof ROLE;

export interface User {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: RoleId;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string; // decimal como texto, ex.: "349.90"
  stock: number;
}

export interface CartItem {
  id: number;
  quantity: number;
  product: Product;
}

/** Carrinho aberto (ainda não pago), como em GET /cart. */
export interface Cart {
  id: number;
  createdAt: string;
  cartItem: CartItem[];
}

export type PaymentMethod = 'pix' | 'credit_card';

export interface PaymentResult {
  id: number;
  amount: string;
  payment_method: PaymentMethod;
  payment_status: string;
  gatewayReference: string;
  cartId: number;
  createdAt: string;
}

export type PaymentAttemptStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'canceled';

/**
 * Tentativa de pagamento, como em POST /payment e GET /payment/attempts/:id.
 * Pix fica "pending" até o cliente pagar; aí vira Pedido (`order`).
 */
export interface PaymentAttempt {
  id: number;
  cartId: number;
  status: PaymentAttemptStatus;
  method: PaymentMethod;
  amount: string;
  expiresAt: string | null;
  pix: { copiaECola: string } | null;
  card: { brand: string; last4: string } | null;
  failure: { code: string; message: string } | null;
  order: PaymentResult | null;
}

export interface Payout {
  id: string;
  amount: number; // em reais
  pixKey: string;
  status: 'pending' | 'paid' | 'failed';
  failureCode: string | null;
  createdAt: string;
}

/** GET /admin/finance: o dinheiro da loja no PSP (valores em reais). */
export type Finance =
  | { configured: false }
  | {
      configured: true;
      payoutPixKey: string | null;
      available: number;
      pending: number;
      receivables: {
        paymentId: string;
        installment: number;
        amount: number;
        availableOn: string;
      }[];
      payouts: Payout[];
    };

/** GET /payment/config: com PSP, o cartão é tokenizado no navegador. */
export interface CheckoutConfig {
  card: { publishableKey: string; pspUrl: string } | null;
}

/** Token de cartão do PSP (POST /v1/tokens): nunca traz o número. */
export interface CardToken {
  id: string;
  card: { brand: string; last4: string; expMonth: number; expYear: number };
}

/** Pedido = carrinho pago, como em GET /orders. Pode depois ser estornado. */
export interface Order {
  id: number;
  amount: string;
  paymentMethod: PaymentMethod;
  // refund_pending: estorno pedido ao gateway, aguardando a resposta
  status: 'paid' | 'refund_pending' | 'refunded';
  gatewayReference: string;
  createdAt: string;
  refundedAt: string | null;
  cartId: number | null;
  customer: Pick<User, 'id' | 'email' | 'firstName' | 'lastName'>;
  items: { productId: number; name: string; price: string; quantity: number }[];
}

interface PeriodTotals {
  revenue: number; // em reais
  paidOrders: number;
  averageTicket: number;
  newUsers: number;
}

/** GET /admin/metrics: resumo de um período (dias de São Paulo). */
export interface Metrics extends PeriodTotals {
  from: string;
  to: string;
  granularity: 'day' | '2h';
  openCarts: number;
  previous: PeriodTotals;
  byMethod: { pix: number; credit_card: number };
  /** start: "2026-10-21" (dia) ou "2026-10-21T14:00" (faixa de 2 h) */
  series: { start: string; revenue: number; orders: number; signups: number }[];
  topProducts: {
    productId: number;
    name: string;
    units: number;
    revenue: number;
  }[];
}
