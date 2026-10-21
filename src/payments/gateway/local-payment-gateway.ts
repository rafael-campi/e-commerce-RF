import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  GatewayPayment,
  GatewayRefund,
  PaymentGateway,
} from './payment-gateway';

/**
 * Gateway provisório: aprova tudo na hora, sem cobrar nada e sem pedir
 * cartão. É o padrão sem PSP_URL (CI, Playwright).
 */
@Injectable()
export class LocalPaymentGateway implements PaymentGateway {
  readonly requiresCardToken = false;

  async requestPayment(): Promise<GatewayPayment> {
    return this.approved(`local-${randomUUID()}`);
  }

  async getPayment(reference: string): Promise<GatewayPayment> {
    return this.approved(reference);
  }

  async cancelPayment(reference: string): Promise<GatewayPayment> {
    // nunca fica pendente, então já foi aprovado
    return this.approved(reference);
  }

  async refundPayment(reference: string): Promise<GatewayRefund> {
    return {
      reference: `local-refund-${reference}`,
      status: 'succeeded',
      failureCode: null,
    };
  }

  private approved(reference: string): GatewayPayment {
    return {
      reference,
      status: 'succeeded',
      pix: null,
      card: null,
      failureCode: null,
      expiresAt: null,
    };
  }
}
