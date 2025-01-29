import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartEntity } from './entities/cart.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from '../users/users.service';
import { ProductsService } from '../products/products.service';
import { ProductsModule } from '../products/products.module';
import { UsersModule } from '../users/users.module';
import { UserEntity } from '../users/entities/user.entity';
import { ProductEntity } from '../products/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CartEntity, UserEntity, ProductEntity]),
    UsersModule,
    ProductsModule,
  ],

  controllers: [CartController],
  providers: [CartService, UserService, ProductsService],
  exports: [CartService],
})
export class CartModule {}
