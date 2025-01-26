import { Module } from '@nestjs/common';
import { CartItemsController } from './cart-items.controller';
import { CartItemsService } from './cart-items.service';
import { CartItemEntity } from './entities/card-items.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/entities/user.entity';

@Module({
  imports: [
        TypeOrmModule.forFeature([CartItemEntity]),
    ],
  controllers: [CartItemsController],
  providers: [CartItemsService],
  exports: [CartItemsService]
})
export class CartItemsModule {}
