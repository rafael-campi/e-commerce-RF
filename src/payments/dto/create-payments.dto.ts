import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { PaymentMethod } from '../../enums/payment.enums';

export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  cartId: number;
}
