import { isNotEmpty, IsNotEmpty, isNumber, IsString } from "class-validator";

export class CreatePaymentDto{

    @IsString()
    @IsNotEmpty()
    paymentMethod: string;


    cartId: number;

}