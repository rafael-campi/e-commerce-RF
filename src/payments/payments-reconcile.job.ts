import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrderRefundsService } from './order-refunds.service';

/**
 * Roda PaymentsService.reconcile de tempos em tempos, para o Estoque de um
 * Pix cujo webhook se perdeu não ficar reservado para sempre.
 * PAYMENTS_RECONCILE_INTERVAL_MS=0 desliga (os testes chamam reconcile direto).
 */
@Injectable()
export class PaymentsReconcileJob
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(PaymentsReconcileJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly paymentService: PaymentsService,
    private readonly orderRefunds: OrderRefundsService,
  ) {}

  onApplicationBootstrap() {
    const configured = process.env.PAYMENTS_RECONCILE_INTERVAL_MS;
    const ms = configured === undefined ? 60_000 : Number(configured);
    if (!(ms > 0)) return;

    this.timer = setInterval(() => void this.run(), ms);
    this.timer.unref();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.paymentService.reconcile();
      await this.orderRefunds.retryStale();
    } catch (error) {
      this.logger.error('Falha na reconciliação de pagamentos', error);
    } finally {
      this.running = false;
    }
  }
}
