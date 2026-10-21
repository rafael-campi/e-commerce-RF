import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { OrdersController } from './orders.controller';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from './payments.service';
import { OrderRefundsService } from './order-refunds.service';
import { PaymentsReconcileJob } from './payments-reconcile.job';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { ProcessedWebhookEventEntity } from './entities/processed-webhook-event.entity';
import { CartModule } from 'src/cart/cart.module';
import { UsersModule } from 'src/users/users.module';
import { ProductsModule } from 'src/products/products.module';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway';
import { LocalPaymentGateway } from './gateway/local-payment-gateway';
import { PspPaymentGateway } from './gateway/psp-payment-gateway';
import { PSP_CLIENT, PspClient } from '../psp/psp-client';

// Com o PSP configurado, Pix e cartão passam pelo PSP próprio (docs/adr/0001);
// sem ele (CI, Playwright), tudo é aprovado na hora pelo gateway local.
function paymentGateway(psp: PspClient | null) {
  return psp ? new PspPaymentGateway(psp) : new LocalPaymentGateway();
}

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentAttemptEntity,
      ProcessedWebhookEventEntity,
    ]),
    CartModule,
    UsersModule,
    ProductsModule,
  ],
  controllers: [PaymentsController, OrdersController, WebhooksController],
  providers: [
    PaymentsService,
    OrderRefundsService,
    PaymentsReconcileJob,
    {
      provide: PAYMENT_GATEWAY,
      useFactory: paymentGateway,
      inject: [PSP_CLIENT],
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
