import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from './payment-gateway';

/**
 * Gateway provisório: não cobra nada de verdade, apenas gera uma referência.
 * Substituir por Stripe/PagSeguro/Pix implementando PaymentGateway.
 */
@Injectable()
export class LocalPaymentGateway implements PaymentGateway {
  async charge(_request: ChargeRequest): Promise<ChargeResult> {
    return { reference: `local-${randomUUID()}` };
  }
}
