import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

/** Painel financeiro do admin: saldo, agenda e repasses da loja no PSP. */
@Module({
  controllers: [FinanceController],
  providers: [FinanceService],
})
export class FinanceModule {}
