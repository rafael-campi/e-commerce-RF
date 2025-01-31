import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payments.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('payment')
export class PaymentsController {

    constructor(
        private readonly paymentService: PaymentsService
    ){}

    @Post()
    create(@Headers() header, @Body() body: CreatePaymentDto){
        return this.paymentService.createPayment(body.paymentMethod, body.cartId, header.user);
    }
    
}
