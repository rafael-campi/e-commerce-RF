import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { join } from 'path'
import * as dotenv from 'dotenv'
import * as pg from 'pg'
import { UserEntity } from '../users/entities/user.entity'
import { ProductEntity } from '../products/entities/product.entity'
import { CartEntity } from '../cart/entities/cart.entity'
import { CartItemEntity } from '../cart-items/entities/card-items.entity'
import { PaymentEntity } from '../payments/entities/payment.entity'
import { PaymentAttemptEntity } from '../payments/entities/payment-attempt.entity'
import { ProcessedWebhookEventEntity } from '../payments/entities/processed-webhook-event.entity'

dotenv.config()

// As colunas são `timestamp` (sem fuso) e o Postgres preenche com now() em UTC.
// Sem isto, o driver lê e grava no fuso do Node: em São Paulo, tudo saía 3 h adiantado.
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value: string) => new Date(`${value.replace(' ', 'T')}Z`))
pg.defaults.parseInputDatesAsUTC = true

export const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'mydatabase',
    synchronize: false,
    logging: true,
    entities: [
        UserEntity,
        ProductEntity,
        CartEntity,
        CartItemEntity,
        PaymentEntity,
        PaymentAttemptEntity,
        ProcessedWebhookEventEntity
    ],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    subscribers: []
})
