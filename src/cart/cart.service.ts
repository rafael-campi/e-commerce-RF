import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartEntity } from './entities/cart.entity';
import { IsNull, Repository } from 'typeorm';
import { CreateCartDto } from './dto/create-cart.dto';
import { ProductEntity } from '../products/entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductsService } from '../products/products.service';
import { UserService } from '../users/users.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { CartItemsService } from 'src/cart-items/cart-items.service';
import { CartItemEntity } from 'src/cart-items/entities/card-items.entity';
import { PaymentAttemptStatus } from '../enums/payment.enums';

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

    return this.toView(savedCart, cartItems);
  }

  // carrinho pago virou Pedido: não aparece mais para o cliente
  async findByUser(user: UserEntity) {
    return this.cartRepository.find({
      where: { user: { id: user.id }, payment: IsNull() },
      relations: ['cartItem'],
      order: { id: 'ASC' },
    });
  }

  async setItem(
    cartId: number,
    productId: number,
    quantity: number,
    user: UserEntity,
  ) {
    const cart = await this.findOpen(cartId, user);
    const [{ product }] = await this.cartItemService.resolveItems([
      { productId, quantity },
    ]);

    await this.cartItemService.setQuantity(cart, product, quantity);

    const updated = await this.findOpen(cartId, user);
    return this.toView(updated, updated.cartItem);
  }

  async removeItem(cartId: number, productId: number, user: UserEntity) {
    const cart = await this.findOpen(cartId, user);
    const item = cart.cartItem.find((i) => i.product.id === productId);

    if (!item) {
      throw new NotFoundException(
        `O produto ${productId} não está no carrinho ${cartId}.`,
      );
    }

    if (cart.cartItem.length === 1) {
      await this.cartRepository.delete(cart.id);
    } else {
      await this.cartItemService.delete(item.id);
    }

    return true;
  }

  async find(id: number) {
    return this.cartRepository.findOne({
      where: { id },
      relations: ['cartItem', 'cartItem.product'],
    });
  }


  async findOwned(id: number, user: UserEntity) {
    return this.cartRepository.findOne({
      where: { id, user: { id: user.id } },
      relations: ['cartItem', 'cartItem.product', 'payment', 'attempts'],
    });
  }

  async attachPayment(id: number, payment: PaymentEntity) {
    await this.cartRepository.update(id, { payment });
  }

  async delete(id: number, user: UserEntity) {
    await this.findOpen(id, user);

    await this.cartRepository.delete(id);

    return true;
  }

  private async findOpen(id: number, user: UserEntity) {
    const cart = await this.findOwned(id, user);

    if (!cart) {
      throw new NotFoundException(`O carrinho ${id} não existe.`);
    }
    if (cart.payment) {
      throw new ConflictException(`O carrinho ${id} já foi pago.`);
    }
    // o Estoque está reservado para a Tentativa: os itens não podem mudar
    if (cart.attempts.some((a) => a.status === PaymentAttemptStatus.PENDING)) {
      throw new ConflictException(
        `O carrinho ${id} tem um pagamento em andamento.`,
      );
    }

    return cart;
  }

  private toView(cart: CartEntity, cartItems: CartItemEntity[]) {
    return {
      id: cart.id,
      createdAt: cart.createdAt,
      items: cartItems.map(({ id, quantity, product }) => ({
        id,
        quantity,
        product,
      })),
    };
  }
}
