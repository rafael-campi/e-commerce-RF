import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../../src/payments/gateway/payment-gateway';
import { PSP_CLIENT } from '../../src/psp/psp-client';

export interface TestAppOptions {
  paymentGateway?: PaymentGateway;
  // imita o PSP (só o método request); sem ele, a loja roda sem PSP
  pspClient?: { request: (...args: unknown[]) => Promise<unknown> };
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });

  if (options.paymentGateway) {
    builder = builder
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(options.paymentGateway);
  }

  if (options.pspClient) {
    builder = builder.overrideProvider(PSP_CLIENT).useValue(options.pspClient);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  await app.init();

  // banco de teste sempre começa do zero, com o schema atual das entidades
  await app.get(DataSource).synchronize(true);

  return app;
}
