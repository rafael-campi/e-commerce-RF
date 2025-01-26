import { Module } from '@nestjs/common';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { CartEntity } from './entities/cart.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from 'src/users/users.service';
import { ProductsService } from 'src/products/products.service';
import { ProductsModule } from 'src/products/products.module';
import { UsersModule } from 'src/users/users.module';
import { UserEntity } from 'src/users/entities/user.entity';
import { ProductEntity } from 'src/products/entities/product.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([CartEntity,UserEntity, ProductEntity]),
      UsersModule, 
      ProductsModule, 
  ],

  controllers: [CartController],
  providers: [CartService, UserService, ProductsService],
  exports: [CartService],
})
export class CartModule {}
