import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { ProductEntity } from './products/entities/product.entity';
import { CartModule } from './cart/cart.module';
import { PaymentsModule } from './payments/payments.module';
import { CartItemsModule } from './cart-items/cart-items.module';
import { CartEntity } from './cart/entities/cart.entity';
import { CartItemEntity } from './cart-items/entities/card-items.entity';
import { PaymentEntity } from './payments/entities/payment.entity';
import { DataSource } from 'typeorm';
import { AuthModule } from './auth/auth.module';
import { AppDataSource } from './database/data-source';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...AppDataSource.options,
        autoLoadEntities: true,
      }),
    }),
    UsersModule,
    ProductsModule,
    CartModule,
    PaymentsModule,
    CartItemsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService
  ],
})
export class AppModule {}
