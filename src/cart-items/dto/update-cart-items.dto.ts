import { PickType } from '@nestjs/mapped-types';
import { CreateCartItemDto } from './create-cart-items.dto';

export class UpdateCartItemsDto extends PickType(CreateCartItemDto, [
  'quantity',
] as const) {}
