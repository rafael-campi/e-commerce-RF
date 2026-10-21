import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class RequestPayoutDto {
  // em reais; sem valor, repassa todo o saldo disponível
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount?: number;
}

export class SetPayoutKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(77)
  pixKey: string;
}
