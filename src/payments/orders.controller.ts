import { Controller, Get } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Roles } from '../decorators/roles.decorator';
import { UserType } from '../enums/user-types.enum';

@Controller('orders')
export class OrdersController {
  constructor(private readonly paymentService: PaymentsService) {}

  @Get()
  @Roles(UserType.ADMIN)
  findAll() {
    return this.paymentService.findOrders();
  }
}
