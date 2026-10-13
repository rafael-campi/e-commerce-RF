import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
} from '../../src/payments/gateway/payment-gateway';

export interface TestAppOptions {
  paymentGateway?: PaymentGateway;
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

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  // banco de teste sempre começa do zero, com o schema atual das entidades
  await app.get(DataSource).synchronize(true);

  return app;
}
