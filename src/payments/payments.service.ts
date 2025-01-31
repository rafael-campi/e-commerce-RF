import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { UserService } from 'src/users/users.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { CartService } from 'src/cart/cart.service';
 import { PaymentStatus } from 'src/enums/payment.enums';
@Injectable()
export class PaymentsService {
    constructor(
        @InjectRepository(PaymentEntity)
        private paymentRepository: Repository<PaymentEntity>,
        private userService: UserService,
        private cartService: CartService
      ) {}

      async createPayment(paymentMethod: string, cartId: number, user: UserEntity){
        const cart = await this.cartService.find(cartId);

        if (!cart || !cart.cartItem) {
          console.log('Carrinho vazio', cart);
          return;
        }

        const amount = cart.cartItem.reduce((sum, item) => {
          const productPrice = Number(item.product.price) || 0;
          return sum + productPrice; 
        }, 0) || 0;

        const payment =  this.paymentRepository.create({
          amount: String(amount),
          payment_method: paymentMethod,
          payment_status: PaymentStatus.PROGRESS,
          user: user
        });

        const savedCart = await this.paymentRepository.save(payment);

        return true;

      }
}
