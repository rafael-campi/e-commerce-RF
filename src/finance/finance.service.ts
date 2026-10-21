import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PSP_CLIENT, PspClient, PspError } from '../psp/psp-client';

// formatos do PSP (payment-ledger-service), em centavos
interface PspBalance {
  available: { amount: number }[];
  pending: { amount: number }[];
}
interface PspReceivable {
  paymentId: string;
  installment: number;
  amount: number;
  availableOn: string;
}
interface PspPayout {
  id: string;
  amount: number;
  pixKey: string;
  status: 'pending' | 'paid' | 'failed';
  failureCode: string | null;
  createdAt: string;
}

// recusas do PSP que o administrador consegue resolver
const PSP_ERRORS: Record<string, string> = {
  'settlement.insufficient_balance': 'O saldo disponível não cobre esse valor.',
  'settlement.amount_too_small': 'O repasse mínimo é de R$ 1,00.',
  'settlement.no_payout_key': 'Cadastre a chave Pix de repasse primeiro.',
  'settlement.invalid_pix_key':
    'Chave Pix inválida: use CPF, CNPJ, e-mail, celular (+55) ou chave aleatória.',
};

const reais = (cents: number) => cents / 100;

/**
 * O dinheiro da loja no PSP: o que já pode sacar, o que vai entrar (agenda
 * de recebíveis) e os repasses para a conta da loja (ADR 0006 do PSP).
 */
@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(@Inject(PSP_CLIENT) private readonly psp: PspClient | null) {}

  async overview() {
    if (!this.psp) return { configured: false as const };
    const psp = this.psp;

    const [account, balance, receivables, payouts] = await this.call(() =>
      Promise.all([
        psp.request<{ payoutPixKey: string | null }>('GET', '/v1/account'),
        psp.request<PspBalance>('GET', '/v1/balance'),
        psp.request<PspReceivable[]>(
          'GET',
          '/v1/receivables?released=false&limit=100',
        ),
        psp.request<PspPayout[]>('GET', '/v1/payouts?limit=20'),
      ]),
    );
    return {
      configured: true as const,
      payoutPixKey: account.payoutPixKey,
      available: reais(balance.available[0]?.amount ?? 0),
      pending: reais(balance.pending[0]?.amount ?? 0),
      // parcelas totalmente estornadas não têm mais nada a liberar
      receivables: receivables
        .filter((r) => r.amount > 0)
        .map((r) => ({
          paymentId: r.paymentId,
          installment: r.installment,
          amount: reais(r.amount),
          availableOn: r.availableOn,
        })),
      payouts: payouts.map(toPayoutView),
    };
  }

  /** Repassa o saldo disponível (ou parte dele) para a chave Pix da loja. */
  async requestPayout(amount: number | undefined, idempotencyKey: string) {
    const psp = this.requirePsp();
    const payout = await this.call(() =>
      psp.request<PspPayout>('POST', '/v1/payouts', {
        idempotencyKey: `admin-payout-${idempotencyKey}`,
        body: amount === undefined ? {} : { amount: Math.round(amount * 100) },
      }),
    );
    return toPayoutView(payout);
  }

  async setPayoutKey(pixKey: string) {
    const psp = this.requirePsp();
    const account = await this.call(() =>
      psp.request<{ payoutPixKey: string }>('PATCH', '/v1/account', {
        idempotencyKey: randomUUID(),
        body: { payoutPixKey: pixKey },
      }),
    );
    return { payoutPixKey: account.payoutPixKey };
  }

  private requirePsp(): PspClient {
    if (!this.psp) {
      throw new ServiceUnavailableException(
        'O financeiro só funciona com a loja ligada a um PSP (PSP_URL).',
      );
    }
    return this.psp;
  }

  // recusas conhecidas viram 422 com a explicação; o resto é falha do PSP
  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const known = error instanceof PspError && PSP_ERRORS[error.code ?? ''];
      if (known) throw new UnprocessableEntityException(known);
      this.logger.error('Falha ao falar com o PSP', error);
      throw new BadGatewayException('Não foi possível falar com o PSP.');
    }
  }
}

function toPayoutView(payout: PspPayout) {
  return {
    id: payout.id,
    amount: reais(payout.amount),
    pixKey: payout.pixKey,
    status: payout.status,
    failureCode: payout.failureCode,
    createdAt: payout.createdAt,
  };
}
