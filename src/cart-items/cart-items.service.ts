import { InjectRepository } from '@nestjs/typeorm';
import { CartItemEntity } from './entities/card-items.entity';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CreateCartItemDto } from './dto/create-cart-items.dto';
import { UpdateCartItemsDto } from './dto/update-cart-items.dto';
import { CartEntity } from 'src/cart/entities/cart.entity';
import { ProductEntity } from 'src/products/entities/product.entity';
import { ProductsService } from 'src/products/products.service';

@Injectable()
export class CartItemsService {
  constructor(
    @InjectRepository(CartItemEntity)
    private cartItemRepository: Repository<CartItemEntity>,
    private productService: ProductsService
  ) {}

  async createMany(items: { productId: number; }[], cart: CartEntity) {
    const cartItems: CartItemEntity[] = [];

    for (const item of items) {
      const product = await this.productService.find(item.productId);

      const cartItem = this.cartItemRepository.create({
        cart,
        product,
      });

      const savedCartItem = await this.cartItemRepository.save(cartItem);
      cartItems.push(savedCartItem);
    }

    return cartItems;
  }

  async findAll() {
    return this.cartItemRepository.find();
  }

  async find(id: number) {
    await this.exists(id);

    return this.cartItemRepository.findOneBy({
      id,
    });
  }

  /*async update(id: number, data: CreateCartItemDto) {
    await this.cartItemRepository.update(id, data);

    return this.find(id);
  }

  async updatePartial(id: number, data: UpdateCartItemsDto) {
    await this.exists(id);

    await this.cartItemRepository.update(id, data);

    return this.find(id);
  }*/

  async delete(id: number) {
    await this.exists(id);

    await this.cartItemRepository.delete(id);

    return true;
  }

  async exists(id: number) {
    if (
      !(await this.cartItemRepository.exist({
        where: {
          id,
        },
      }))
    ) {
      throw new NotFoundException(`O produto ${id} não existe.`);
    }
  }
}
