import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { OrderRefundsService } from './order-refunds.service';
import { Roles } from '../decorators/roles.decorator';
import { UserType } from '../enums/user-types.enum';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly paymentService: PaymentsService,
    private readonly orderRefunds: OrderRefundsService,
  ) {}

  @Get()
  @Roles(UserType.ADMIN)
  findAll() {
    return this.paymentService.findOrders();
  }

  // estorna o Pedido inteiro; os itens voltam ao Estoque (ver CONTEXT.md)
  @Post(':id/refund')
  @Roles(UserType.ADMIN)
  @HttpCode(HttpStatus.OK)
  refund(@Param('id', ParseIntPipe) id: number) {
    return this.orderRefunds.refund(id);
  }
}
