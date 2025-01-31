import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateCartItemDto } from "src/cart-items/dto/create-cart-items.dto";

export class CreateCartDto {
  @IsArray()
  @ValidateNested({ each: true }) 
  @Type(() => CreateCartItemDto) 
  items: CreateCartItemDto[];
}