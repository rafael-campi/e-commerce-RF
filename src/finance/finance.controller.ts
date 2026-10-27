import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { UserType } from '../enums/user-types.enum';
import { RequestPayoutDto, SetPayoutKeyDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('admin/finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  @Roles(UserType.ADMIN)
  overview() {
    return this.finance.overview();
  }

  // o front manda uma chave por clique: repetir a requisição não repassa duas vezes
  @Post('payouts')
  @Roles(UserType.ADMIN)
  requestPayout(
    @Body() body: RequestPayoutDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ) {
    if (!idempotencyKey || !/^[\w-]{8,64}$/.test(idempotencyKey)) {
      throw new BadRequestException('Envie o cabeçalho Idempotency-Key.');
    }
    return this.finance.requestPayout(body.amount, idempotencyKey);
  }

  @Put('payout-key')
  @Roles(UserType.ADMIN)
  setPayoutKey(@Body() body: SetPayoutKeyDto) {
    return this.finance.setPayoutKey(body.pixKey);
  }
}
