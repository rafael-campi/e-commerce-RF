import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CartEntity } from '../cart/entities/cart.entity';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity, UserEntity, CartEntity])],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
