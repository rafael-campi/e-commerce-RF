import { IsEnum, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { PaymentMethod } from '../../enums/payment.enums';

export class CreatePaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  cartId: number;

  // cartão com o PSP: o token que o navegador obteve em POST /v1/tokens
  @IsOptional()
  @Matches(/^tok_[0-9a-f]{24}$/, { message: 'cardToken inválido.' })
  cardToken?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;
}
