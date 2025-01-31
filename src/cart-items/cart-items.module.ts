import { Module } from '@nestjs/common';
import { CartItemsService } from './cart-items.service';
import { CartItemEntity } from './entities/card-items.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';
import { ProductsService } from 'src/products/products.service';
import { ProductEntity } from 'src/products/entities/product.entity';
import { ProductsModule } from 'src/products/products.module';

@Module({
  imports: [TypeOrmModule.forFeature([CartItemEntity]), ProductsModule],
  providers: [CartItemsService],
  exports: [CartItemsService],
})
export class CartItemsModule {}
