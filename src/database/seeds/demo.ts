import * as bcrypt from 'bcryptjs';
import { DataSource, Like } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ProductEntity } from '../../products/entities/product.entity';
import { CartEntity } from '../../cart/entities/cart.entity';
import { CartItemEntity } from '../../cart-items/entities/card-items.entity';
import { PaymentEntity } from '../../payments/entities/payment.entity';
import { PaymentStatus } from '../../enums/payment.enums';
import { UserType } from '../../enums/user-types.enum';

// Dados de DEMONSTRAÇÃO para o dashboard ter forma: clientes e Pedidos pagos espalhados
// pelos últimos 30 dias. Não são vendas reais (referência "DEMO-…") e não mexem no estoque.
// Só entra com `yarn seed --demo`; testes e o seed normal não usam.

const CUSTOMERS = [
  ['julia.rocha@email.com', 'Júlia', 'Rocha', UserType.USER],
  ['thiago.lima@email.com', 'Thiago', 'Lima', UserType.MODERATOR],
  ['ana.souza@email.com', 'Ana', 'Souza', UserType.USER],
  ['pedro.alves@email.com', 'Pedro', 'Alves', UserType.USER],
  ['camila.nunes@email.com', 'Camila', 'Nunes', UserType.USER],
  ['bruno.costa@email.com', 'Bruno', 'Costa', UserType.USER],
] as const;

const ORDERS = 120;
const DAY = 86400_000;

/** Gerador pseudoaleatório com semente fixa: o demo sai igual em toda máquina. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedDemo(dataSource: DataSource) {
  const payments = dataSource.getRepository(PaymentEntity);
  if (await payments.existsBy({ gatewayReference: Like('DEMO-%') })) return;

  const users = dataSource.getRepository(UserEntity);
  const carts = dataSource.getRepository(CartEntity);
  const items = dataSource.getRepository(CartItemEntity);
  const rand = random(42);
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(rand() * list.length)];
  const now = Date.now();

  const password = await bcrypt.hash('123456', 10);
  const customers: UserEntity[] = [];
  for (const [i, [email, firstName, lastName, role]] of CUSTOMERS.entries()) {
    const user =
      (await users.findOneBy({ email })) ??
      (await users.save(
        users.create({ email, firstName, lastName, role, password }),
      ));
    // cadastros espalhados pelo último mês
    await users.update(user.id, {
      createdAt: new Date(now - (28 - i * 4) * DAY),
    });
    customers.push(user);
  }
  const cliente = await users.findOneBy({ email: 'cliente@prateleira.com' });
  if (cliente) customers.push(cliente);

  const products = (
    await dataSource.getRepository(ProductEntity).find()
  ).filter((p) => p.stock > 0);
  if (!products.length) return;

  for (let n = 0; n < ORDERS; n++) {
    // mais vendas nos dias recentes, entre 8h e 23h de São Paulo
    const daysAgo = Math.floor(Math.pow(rand(), 1.4) * 30);
    const hour = 8 + Math.floor(rand() * 15);
    const day = new Date(now - daysAgo * DAY);
    const when = new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        hour + 3,
        Math.floor(rand() * 60),
      ),
    );
    const createdAt =
      when.getTime() > now
        ? new Date(now - Math.floor(rand() * 3600_000))
        : when;

    const user = pick(customers);
    const chosen = [
      ...new Set(
        Array.from({ length: 1 + Math.floor(rand() * 3) }, () =>
          pick(products),
        ),
      ),
    ];
    const lines = chosen.map((product) => ({
      product,
      quantity: 1 + Math.floor(rand() * 2),
    }));
    const amount = lines.reduce(
      (sum, l) => sum + Math.round(Number(l.product.price) * 100) * l.quantity,
      0,
    );

    const payment = await payments.save(
      payments.create({
        amount: (amount / 100).toFixed(2),
        payment_method: rand() < 0.58 ? 'pix' : 'credit_card',
        payment_status: PaymentStatus.PAID,
        gatewayReference: `DEMO-${(n + 1).toString().padStart(4, '0')}`,
        user,
      }),
    );
    const cart = await carts.save(carts.create({ user, payment }));
    await items.save(
      lines.map((l) =>
        items.create({ cart, product: l.product, quantity: l.quantity }),
      ),
    );
    await payments.update(payment.id, { createdAt });
    await carts.update(cart.id, { createdAt });
  }
}
