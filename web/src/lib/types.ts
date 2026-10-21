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

/** Pedido = carrinho pago, como em GET /orders. */
export interface Order {
  id: number;
  amount: string;
  paymentMethod: PaymentMethod;
  status: 'paid';
  gatewayReference: string;
  createdAt: string;
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
