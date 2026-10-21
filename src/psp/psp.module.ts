import { Global, Module } from '@nestjs/common';
import { PSP_CLIENT, PspClient } from './psp-client';

/** O cliente do PSP, ou null sem PSP_URL (CI, Playwright). */
@Global()
@Module({
  providers: [{ provide: PSP_CLIENT, useFactory: () => PspClient.fromEnv() }],
  exports: [PSP_CLIENT],
})
export class PspModule {}
