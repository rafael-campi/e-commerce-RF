import { IsInt, IsNotEmpty, IsString, Validate } from "class-validator";
import { ProductExists } from "../../products/validator/product.validator";

export class CreateCartItemDto {
        
    @IsInt()
    @IsNotEmpty()
    @Validate(ProductExists)
    productId: number;

    @IsInt()
    @IsNotEmpty()
    quantity: number;

    @IsString()
    @IsNotEmpty()
    userId: string;
}