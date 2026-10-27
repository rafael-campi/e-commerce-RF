const TIMEOUT_MS = 10_000;

export const PSP_CLIENT = Symbol('PSP_CLIENT');

export class PspError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Chamadas à API do PSP próprio (payment-ledger-service) com a chave
 * secreta da loja. Só roda no servidor: a chave nunca vai ao navegador.
 */
export class PspClient {
  constructor(private readonly config: { url: string; secretKey: string }) {}

  /** Lê PSP_URL e PSP_SECRET_KEY; null quando a loja não está ligada a um PSP. */
  static fromEnv(): PspClient | null {
    const url = process.env.PSP_URL;
    if (!url) return null;
    const secretKey = process.env.PSP_SECRET_KEY;
    if (!secretKey) {
      throw new Error('PSP_URL está definido, mas PSP_SECRET_KEY não.');
    }
    return new PspClient({ url, secretKey });
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options: { idempotencyKey?: string; body?: object } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.secretKey}`,
    };
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }
    if (options.body) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${this.config.url}${path}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = (await response.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;

    if (!response.ok) {
      throw new PspError(
        response.status,
        data?.error,
        `PSP respondeu ${response.status} em ${method} ${path}: ${data?.message ?? ''}`,
      );
    }
    return data as T;
  }
}
