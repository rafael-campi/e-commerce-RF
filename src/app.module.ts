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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        UserEntity,
        ProductEntity,
        CartEntity,
        CartItemEntity,
        PaymentEntity,
      ],
      synchronize: true,
      logging: true,
      migrations: ['./src/database/migrations/*.ts'],
    }),
    UsersModule,
    ProductsModule,
    CartModule,
    PaymentsModule,
    CartItemsModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
