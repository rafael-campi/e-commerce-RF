import { InjectRepository } from '@nestjs/typeorm';
import { CartItemEntity } from './entities/card-items.entity';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async resolveItems(items: CreateCartItemDto[]) {
    const resolved: { product: ProductEntity; quantity: number }[] = [];

    for (const item of items) {
      const product = await this.productService.find(item.productId);
      resolved.push({ product, quantity: item.quantity });
    }

    this.assertWithinStock(resolved);

    return resolved;
  }

  private assertWithinStock(
    items: { product: ProductEntity; quantity: number }[],
  ) {
    const requested = new Map<number, number>();
    for (const { product, quantity } of items) {
      const total = (requested.get(product.id) ?? 0) + quantity;
      requested.set(product.id, total);

      if (product.stock !== null && total > product.stock) {
        throw new BadRequestException(
          `Estoque insuficiente para "${product.name}": disponível ${product.stock}, pedido ${total}.`,
        );
      }
    }
  }

  async createMany(
    items: { product: ProductEntity; quantity: number }[],
    cart: CartEntity,
  ) {
    const cartItems: CartItemEntity[] = [];

    for (const { product, quantity } of items) {
      const cartItem = this.cartItemRepository.create({
        cart,
        product,
        quantity,
      });

      cartItems.push(await this.cartItemRepository.save(cartItem));
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
