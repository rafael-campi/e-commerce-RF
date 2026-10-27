import type {
  Cart,
  CardToken,
  CheckoutConfig,
  Finance,
  Metrics,
  Order,
  PaymentAttempt,
  PaymentMethod,
  Payout,
  Product,
  RoleId,
  User,
} from './types';

const TOKEN_KEY = 'prateleira.token';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const token = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(value: string | null) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // sem storage (aba privada): a sessão dura só enquanto a página estiver aberta
    }
  },
};

// O AuthProvider registra aqui o que fazer quando a API recusa o token.
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = { ...extraHeaders };
  const current = token.get();
  if (current) headers.Authorization = `Bearer ${current}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Não foi possível falar com o servidor.');
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    // login com senha errada também é 401, mas aí não havia sessão para expirar
    if (response.status === 401 && current) onUnauthorized();
    const message = Array.isArray(data?.message)
      ? data.message.join(' ')
      : (data?.message ?? response.statusText);
    throw new ApiError(response.status, message);
  }

  return data as T;
}

/**
 * Só em dev: faz o papel do banco do cliente e paga um Pix no simulador do
 * PSP (proxy /psp-simulator no vite.config.ts). O txid vem do copia e cola.
 */
export async function simulatePixPayment(copiaECola: string) {
  // campo EMV 26 → subcampo 25 (location): "25" + tamanho com 2 dígitos + URL;
  // o txid é o fim da URL (os campos vêm colados, então lê pelo tamanho)
  const at = copiaECola.indexOf('br.gov.bcb.pix25');
  const length = Number(copiaECola.slice(at + 16, at + 18));
  const location = copiaECola.slice(at + 18, at + 18 + length);
  const txid = location.match(/\/qr\/v2\/([A-Za-z0-9]+)$/)?.[1];
  if (at < 0 || !txid)
    throw new ApiError(0, 'Este copia e cola não é do simulador.');
  const response = await fetch(`/psp/simulator/pix/${txid}/pay`, {
    method: 'POST',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.message ?? response.statusText);
  }
}

// recusas do cofre do PSP, no campo em que o cliente pode corrigir
const CARD_ERRORS: Record<string, { field: CardField; message: string }> = {
  'vault.invalid_number': {
    field: 'number',
    message: 'Número do cartão inválido.',
  },
  'vault.unsupported_brand': {
    field: 'number',
    message: 'Aceitamos Visa, Mastercard, Elo, Hipercard e American Express.',
  },
  'vault.expired_card': {
    field: 'expiry',
    message: 'Este cartão está vencido.',
  },
  'vault.invalid_expiry': { field: 'expiry', message: 'Validade inválida.' },
  'vault.invalid_cvc': {
    field: 'cvc',
    message: 'Código de segurança inválido.',
  },
};

export type CardField = 'number' | 'expiry' | 'cvc' | 'name';

/** Recusa do cartão antes de cobrar: aponta o campo a corrigir. */
export class CardError extends Error {
  constructor(
    readonly field: CardField | null,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Manda o cartão do navegador direto ao PSP, com a chave publicável, e
 * devolve só o token: o número nunca passa pela API da loja (docs/adr/0001).
 */
export async function tokenizeCard(
  config: NonNullable<CheckoutConfig['card']>,
  card: {
    number: string;
    expMonth: number;
    expYear: number;
    cvc: string;
    holderName: string;
  },
): Promise<CardToken> {
  let response: Response;
  try {
    response = await fetch(`${config.pspUrl}/v1/tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.publishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ card }),
    });
  } catch {
    throw new CardError(null, 'Não foi possível falar com a operadora.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const known = CARD_ERRORS[data?.error];
    throw known
      ? new CardError(known.field, known.message)
      : new CardError(null, 'Confira os dados do cartão e tente de novo.');
  }
  return data as CardToken;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ access_token: string }>('POST', '/auth/login', {
      email,
      password,
    }),
  me: () => request<User>('GET', '/auth/me'),
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => request<User>('POST', '/users', data),

  products: () => request<Product[]>('GET', '/products'),
  product: (id: number) => request<Product>('GET', `/products/${id}`),
  createProduct: (data: Omit<Product, 'id' | 'price'> & { price: number }) =>
    request<Product>('POST', '/products', data),
  updateProduct: (
    id: number,
    data: Omit<Product, 'id' | 'price'> & { price: number },
  ) => request<Product>('PATCH', `/products/${id}`, data),
  deleteProduct: (id: number) => request<boolean>('DELETE', `/products/${id}`),

  carts: () => request<Cart[]>('GET', '/cart'),
  createCart: (productId: number, quantity: number) =>
    request<{ id: number }>('POST', '/cart', {
      items: [{ productId, quantity }],
    }),
  setCartItem: (cartId: number, productId: number, quantity: number) =>
    request<{ id: number }>('PUT', `/cart/${cartId}/items/${productId}`, {
      quantity,
    }),
  removeCartItem: (cartId: number, productId: number) =>
    request<boolean>('DELETE', `/cart/${cartId}/items/${productId}`),
  deleteCart: (cartId: number) => request<boolean>('DELETE', `/cart/${cartId}`),

  checkoutConfig: () => request<CheckoutConfig>('GET', '/payment/config'),
  pay: (
    cartId: number,
    paymentMethod: PaymentMethod,
    card?: { token: string; installments: number },
  ) =>
    request<PaymentAttempt>('POST', '/payment', {
      cartId,
      paymentMethod,
      ...(card
        ? { cardToken: card.token, installments: card.installments }
        : {}),
    }),
  paymentAttempt: (id: number) =>
    request<PaymentAttempt>('GET', `/payment/attempts/${id}`),
  cancelPaymentAttempt: (id: number) =>
    request<PaymentAttempt>('POST', `/payment/attempts/${id}/cancel`),
  orders: () => request<Order[]>('GET', '/orders'),
  refundOrder: (id: number) => request<Order>('POST', `/orders/${id}/refund`),
  finance: () => request<Finance>('GET', '/admin/finance'),
  // a chave vem de quem clicou: repetir o pedido não repassa duas vezes
  requestPayout: (amount: number | undefined, idempotencyKey: string) =>
    request<Payout>(
      'POST',
      '/admin/finance/payouts',
      amount === undefined ? {} : { amount },
      { 'Idempotency-Key': idempotencyKey },
    ),
  setPayoutKey: (pixKey: string) =>
    request<{ payoutPixKey: string }>('PUT', '/admin/finance/payout-key', {
      pixKey,
    }),
  metrics: (from: string, to: string) =>
    request<Metrics>('GET', `/admin/metrics?from=${from}&to=${to}`),

  users: () => request<User[]>('GET', '/users'),
  updateUser: (
    id: number,
    data: { email: string; firstName: string; lastName: string; role: RoleId },
  ) => request<User>('PATCH', `/users/${id}`, data),
  deleteUser: (id: number) => request<boolean>('DELETE', `/users/${id}`),
};
