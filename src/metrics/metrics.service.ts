import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  And,
  IsNull,
  LessThan,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { PaymentEntity } from '../payments/entities/payment.entity';
import { PaymentStatus } from '../enums/payment.enums';
import { UserEntity } from '../users/entities/user.entity';
import { CartEntity } from '../cart/entities/cart.entity';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// Os dias do dashboard são dias de São Paulo: UTC-3 fixo (sem horário de verão desde 2019).
const SP_OFFSET = 3 * HOUR;
const MAX_DAYS = 60;

/** "2026-10-21" → meia-noite UTC daquele dia; null se a data não existe. */
function parseDay(value: string): number | null {
  const [y, m, d] = value.split('-').map(Number);
  const time = Date.UTC(y, m - 1, d);
  return new Date(time).toISOString().slice(0, 10) === value ? time : null;
}

const cents = (value: string | number) => Math.round(Number(value) * 100);
const reais = (value: number) => value / 100;

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(PaymentEntity)
    private payments: Repository<PaymentEntity>,
    @InjectRepository(UserEntity)
    private users: Repository<UserEntity>,
    @InjectRepository(CartEntity)
    private carts: Repository<CartEntity>,
  ) {}

  async summary(fromDay: string, toDay: string) {
    const from = parseDay(fromDay);
    const to = parseDay(toDay);
    if (from === null || to === null) {
      throw new BadRequestException('Data inexistente; use AAAA-MM-DD.');
    }
    if (from > to) {
      throw new BadRequestException('A data inicial é depois da final.');
    }
    const days = (to - from) / DAY + 1;
    if (days > MAX_DAYS) {
      throw new BadRequestException(
        `O período pode ter no máximo ${MAX_DAYS} dias.`,
      );
    }

    const start = from + SP_OFFSET;
    const end = to + DAY + SP_OFFSET;
    const previousStart = start - days * DAY;
    const between = (a: number, b: number) =>
      And(MoreThanOrEqual(new Date(a)), LessThan(new Date(b)));

    // Pedido = carrinho pago (ver CONTEXT.md)
    // estornados não contam: o dinheiro voltou ao Cliente
    const orders = await this.payments.find({
      where: {
        createdAt: between(previousStart, end),
        payment_status: Not(PaymentStatus.REFUNDED),
      },
      relations: ['carts', 'carts.cartItem', 'carts.cartItem.product'],
    });
    const signups = await this.users.find({
      select: ['id', 'createdAt'],
      where: { createdAt: between(previousStart, end) },
    });
    const openCarts = await this.carts.count({ where: { payment: IsNull() } });

    const inPeriod = <T extends { createdAt: Date }>(
      list: T[],
      a: number,
      b: number,
    ) =>
      list.filter(
        (x) => x.createdAt.getTime() >= a && x.createdAt.getTime() < b,
      );
    const current = inPeriod(orders, start, end);
    const previous = inPeriod(orders, previousStart, start);
    const totals = (list: PaymentEntity[]) => {
      const revenue = list.reduce((sum, o) => sum + cents(o.amount), 0);
      return {
        revenue: reais(revenue),
        paidOrders: list.length,
        averageTicket: list.length
          ? reais(Math.round(revenue / list.length))
          : 0,
      };
    };

    // um dia só: faixas de 2 h; mais de um: um ponto por dia
    const granularity = days === 1 ? '2h' : 'day';
    const size = days === 1 ? 2 * HOUR : DAY;
    const series = Array.from({ length: (end - start) / size }, (_, i) => ({
      // horário de São Paulo, sem fuso: "2026-10-21" ou "2026-10-21T14:00"
      start: new Date(start + i * size - SP_OFFSET)
        .toISOString()
        .slice(0, days === 1 ? 16 : 10),
      revenue: 0,
      orders: 0,
      signups: 0,
    }));
    const bucket = (date: Date) =>
      series[Math.floor((date.getTime() - start) / size)];
    for (const o of current) {
      const b = bucket(o.createdAt);
      b.revenue += cents(o.amount);
      b.orders += 1;
    }
    for (const u of inPeriod(signups, start, end))
      bucket(u.createdAt).signups += 1;
    for (const b of series) b.revenue = reais(b.revenue);

    const byProduct = new Map<
      number,
      { productId: number; name: string; units: number; revenue: number }
    >();
    for (const item of current.flatMap((o) =>
      o.carts.flatMap((c) => c.cartItem),
    )) {
      const entry = byProduct.get(item.product.id) ?? {
        productId: item.product.id,
        name: item.product.name,
        units: 0,
        revenue: 0,
      };
      entry.units += item.quantity;
      entry.revenue += cents(item.product.price) * item.quantity;
      byProduct.set(item.product.id, entry);
    }
    const topProducts = [...byProduct.values()]
      .sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))
      .slice(0, 5)
      .map((p) => ({ ...p, revenue: reais(p.revenue) }));

    return {
      from: fromDay,
      to: toDay,
      granularity,
      ...totals(current),
      newUsers: inPeriod(signups, start, end).length,
      openCarts,
      previous: {
        ...totals(previous),
        newUsers: inPeriod(signups, previousStart, start).length,
      },
      byMethod: {
        pix: current.filter((o) => o.payment_method === 'pix').length,
        credit_card: current.filter((o) => o.payment_method === 'credit_card')
          .length,
      },
      series,
      topProducts,
    };
  }
}
