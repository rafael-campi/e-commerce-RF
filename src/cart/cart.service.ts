import { Injectable } from '@nestjs/common';
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

    
    const cart = this.cartRepository.create({ user });

    // Salvar o carrinho no banco de dados
    const savedCart = await this.cartRepository.save(cart);

    // Criar os itens do carrinho
    const cartItems = await this.cartItemService.createMany(data.items, savedCart);

    return { ...savedCart, items: cartItems };
  }

  async findByUser(userSearch: UserEntity) {
    return this.cartRepository.find({
      where: { user: userSearch },
      relations: ['cartItem'],
    });
  }


  async delete(id: number) {
    await this.cartRepository.delete(id);

    return true;
  }
}
