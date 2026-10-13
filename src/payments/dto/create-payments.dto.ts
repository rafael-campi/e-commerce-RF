import { IsEnum, IsInt } from 'class-validator';
import { PaymentMethod } from '../../enums/payment.enums';

export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsInt()
  cartId: number;
}
