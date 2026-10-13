import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CartService } from '../cart/cart.service';
import { PaymentMethod, PaymentStatus } from '../enums/payment.enums';
import { PAYMENT_GATEWAY, PaymentGateway } from './gateway/payment-gateway';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    private cartService: CartService,
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
  ) {}

  async createPayment(
    paymentMethod: PaymentMethod,
    cartId: number,
    user: UserEntity,
  ) {
    const cart = await this.cartService.findOwned(cartId, user);

    if (!cart) {
      throw new NotFoundException(`O carrinho ${cartId} não existe.`);
    }
    if (cart.payment) {
      throw new ConflictException(`O carrinho ${cartId} já foi pago.`);
    }

    // soma em centavos para não acumular erro de ponto flutuante
    const cents = cart.cartItem.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.product.price) * 100) * item.quantity,
      0,
    );
    const amount = (cents / 100).toFixed(2);

    let reference: string;
    try {
      ({ reference } = await this.gateway.charge({
        amount,
        method: paymentMethod,
      }));
    } catch {
      throw new BadGatewayException('Falha ao processar o pagamento.');
    }

    const payment = await this.paymentRepository.save(
      this.paymentRepository.create({
        amount,
        payment_method: paymentMethod,
        payment_status: PaymentStatus.PROGRESS,
        gatewayReference: reference,
        user,
      }),
    );
    await this.cartService.attachPayment(cart.id, payment);

    return {
      id: payment.id,
      amount: payment.amount,
      payment_method: payment.payment_method,
      payment_status: payment.payment_status,
      gatewayReference: payment.gatewayReference,
      cartId: cart.id,
      userId: user.id,
      createdAt: payment.createdAt,
    };
  }
}
