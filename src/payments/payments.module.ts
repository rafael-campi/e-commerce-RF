import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { CartModule } from 'src/cart/cart.module';
import { UsersModule } from 'src/users/users.module';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway';
import { LocalPaymentGateway } from './gateway/local-payment-gateway';

@Module({
  imports:[TypeOrmModule.forFeature([PaymentEntity]), CartModule, UsersModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    { provide: PAYMENT_GATEWAY, useClass: LocalPaymentGateway },
  ],
  exports:[PaymentsService]
})
export class PaymentsModule {}
