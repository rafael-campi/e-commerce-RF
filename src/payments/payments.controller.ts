import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
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
      { token: body.cardToken, installments: body.installments },
    );
  }

  // o checkout lê aqui a chave publicável para tokenizar o cartão no PSP
  @Get('config')
  config() {
    return this.paymentService.checkoutConfig();
  }

  // o front acompanha um Pix pendente até ele virar Pedido
  @Get('attempts/:id')
  findAttempt(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.paymentService.getAttempt(id, req.user);
  }

  @Post('attempts/:id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelAttempt(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.paymentService.cancelAttempt(id, req.user);
  }
}
