import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { UserService } from 'src/users/users.service';
import { UserEntity } from 'src/users/entities/user.entity';
import { CartService } from 'src/cart/cart.service';

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
          const productPrice = Number(item.product.price) || 0; // Evita erro se product for undefined
          return sum + productPrice; // Considera a quantidade do item
        }, 0) || 0;

        //const amount = 
        console.log("CART: ", amount);
        const payment =  this.paymentRepository.create({
          amount: String(amount),
          payment_method: paymentMethod,
          payment_status:'progress',
          user: user
        });

        const savedCart = await this.paymentRepository.save(payment);

        return true;

      }
}
