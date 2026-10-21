import type {
  Cart,
  Metrics,
  Order,
  PaymentMethod,
  PaymentResult,
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
): Promise<T> {
  const headers: Record<string, string> = {};
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

  pay: (cartId: number, paymentMethod: PaymentMethod) =>
    request<PaymentResult>('POST', '/payment', { cartId, paymentMethod }),
  orders: () => request<Order[]>('GET', '/orders'),
  metrics: (from: string, to: string) =>
    request<Metrics>('GET', `/admin/metrics?from=${from}&to=${to}`),

  users: () => request<User[]>('GET', '/users'),
  updateUser: (
    id: number,
    data: { email: string; firstName: string; lastName: string; role: RoleId },
  ) => request<User>('PATCH', `/users/${id}`, data),
  deleteUser: (id: number) => request<boolean>('DELETE', `/users/${id}`),
};
