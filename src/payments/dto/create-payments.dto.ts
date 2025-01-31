import { isNotEmpty, IsNotEmpty, isNumber, IsString } from "class-validator";

export class CreatePaymentDto{

    @IsString()
    @IsNotEmpty()
    payment_method: string;


    cartId: number;

}