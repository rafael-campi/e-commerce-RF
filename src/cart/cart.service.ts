import { Injectable, NotFoundException } from '@nestjs/common';
import { CartEntity } from './entities/cart.entity';
import { Repository } from 'typeorm';
import { CreateCartDto } from './dto/create-cart.dto';
import { ProductEntity } from '../products/entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductsService } from '../products/products.service';
import { UserService } from '../users/users.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { CartItemsService } from 'src/cart-items/cart-items.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private cartRepository: Repository<CartEntity>,
    private cartItemService: CartItemsService
  ) {}

  async create(data: CreateCartDto, user: UserEntity) {
    // valida todos os produtos antes de persistir, para não deixar carrinho órfão
    const items = await this.cartItemService.resolveItems(data.items);

    const savedCart = await this.cartRepository.save(
      this.cartRepository.create({ user }),
    );
    const cartItems = await this.cartItemService.createMany(items, savedCart);

    return {
      id: savedCart.id,
      createdAt: savedCart.createdAt,
      items: cartItems.map(({ id, quantity, product }) => ({
        id,
        quantity,
        product,
      })),
    };
  }

  async findByUser(user: UserEntity) {
    return this.cartRepository.find({
      where: { user: { id: user.id } },
      relations: ['cartItem'],
    });
  }

  async find(id: number) {
    return this.cartRepository.findOne({
      where: { id },
      relations: ['cartItem', 'cartItem.product'],
    });
  }


  async delete(id: number, user: UserEntity) {
    const cart = await this.cartRepository.findOneBy({
      id,
      user: { id: user.id },
    });

    if (!cart) {
      throw new NotFoundException(`O carrinho ${id} não existe.`);
    }

    await this.cartRepository.delete(id);

    return true;
  }
}
