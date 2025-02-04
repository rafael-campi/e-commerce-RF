import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { join } from 'path'
import * as dotenv from 'dotenv'
import { UserEntity } from '../users/entities/user.entity'
import { ProductEntity } from '../products/entities/product.entity'
import { CartEntity } from '../cart/entities/cart.entity'
import { CartItemEntity } from '../cart-items/entities/card-items.entity'
import { PaymentEntity } from '../payments/entities/payment.entity'

dotenv.config()

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
        PaymentEntity
    ],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    subscribers: []
})
