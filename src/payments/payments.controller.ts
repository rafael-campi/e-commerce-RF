import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payments.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('payment')
export class PaymentsController {
  constructor(private readonly paymentService: PaymentsService) {}

  @Post()
  create(@Request() req, @Body() body: CreatePaymentDto) {
    return this.paymentService.createPayment(
      body.paymentMethod,
      body.cartId,
      req.user,
    );
  }
}
