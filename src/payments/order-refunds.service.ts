import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, EntityManager, LessThan } from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { PaymentStatus } from '../enums/payment.enums';
import { PspError } from '../psp/psp-client';
import {
  GatewayRefund,
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './gateway/payment-gateway';
import { ORDER_RELATIONS, toOrderView } from './order-view';

// sem resposta do gateway por mais que isso, o estorno é pedido de novo
// (a mesma chave de idempotência: nunca estorna duas vezes)
const RETRY_AFTER_MS = 5 * 60_000;

const REFUSALS: Record<string, string> = {
  'refunds.payment_not_refundable':
    'O pagamento deste pedido não pode mais ser estornado.',
  'refunds.amount_not_refundable': 'Este pedido já foi estornado no gateway.',
};

/**
 * Estorno de Pedido (ver CONTEXT.md): o Pedido inteiro, feito pelo
 * Administrador. O dinheiro volta ao Cliente pelo gateway e os itens voltam
 * ao Estoque. A taxa do gateway não volta.
 */
@Injectable()
export class OrderRefundsService {
  private readonly logger = new Logger(OrderRefundsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /** Idempotente: um Pedido já estornado (ou estornando) volta como está. */
  async refund(orderId: number) {
    // trava e marca "estornando" antes de chamar o gateway: dois cliques
    // não viram dois estornos
    const order = await this.dataSource.transaction(async (m) => {
      const locked = await m.findOne(PaymentEntity, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(`O pedido ${orderId} não existe.`);
      }
      if (locked.payment_status !== PaymentStatus.PAID) return null;
      await m.update(PaymentEntity, locked.id, {
        payment_status: PaymentStatus.REFUND_PENDING,
        refundRequestedAt: new Date(),
      });
      return locked;
    });
    if (order) await this.askGateway(order);
    return this.view(orderId);
  }

  /**
   * Aplica a resposta do gateway (direta, ou por webhook refund.*). Só um
   * Pedido "estornando" muda.
   */
  async settle(
    paymentReference: string,
    result: Pick<GatewayRefund, 'status' | 'reference'>,
    manager?: EntityManager,
  ): Promise<PaymentEntity | null> {
    if (!manager) {
      return this.dataSource.transaction((m) =>
        this.settle(paymentReference, result, m),
      );
    }
    const locked = await manager.findOne(PaymentEntity, {
      where: {
        gatewayReference: paymentReference,
        payment_status: PaymentStatus.REFUND_PENDING,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) return null;

    if (result.status === 'pending') {
      await manager.update(PaymentEntity, locked.id, {
        refundReference: result.reference,
      });
    } else if (result.status === 'failed') {
      await manager.update(PaymentEntity, locked.id, {
        payment_status: PaymentStatus.PAID,
      });
    } else {
      const order = await manager.findOneOrFail(PaymentEntity, {
        where: { id: locked.id },
        relations: ['carts', 'carts.cartItem', 'carts.cartItem.product'],
      });
      // os itens voltam ao Estoque (a loja não tem envio: estornar desfaz a venda)
      for (const { product, quantity } of order.carts.flatMap(
        (c) => c.cartItem,
      )) {
        await manager.increment(
          ProductEntity,
          { id: product.id },
          'stock',
          quantity,
        );
      }
      await manager.update(PaymentEntity, locked.id, {
        payment_status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
        refundReference: result.reference,
      });
    }
    return locked;
  }

  /** Pede de novo os estornos sem resposta há tempo demais. */
  async retryStale(now = new Date()) {
    const stale = await this.dataSource.getRepository(PaymentEntity).find({
      where: {
        payment_status: PaymentStatus.REFUND_PENDING,
        refundRequestedAt: LessThan(new Date(now.getTime() - RETRY_AFTER_MS)),
      },
    });
    for (const order of stale) await this.askGateway(order);
    return stale.length;
  }

  private async askGateway(order: PaymentEntity) {
    let result: GatewayRefund;
    try {
      result = await this.gateway.refundPayment(
        order.gatewayReference!,
        `order-${order.id}-refund`,
      );
    } catch (error) {
      if (
        error instanceof PspError &&
        error.status >= 400 &&
        error.status < 500
      ) {
        // recusa definitiva: o Pedido continua pago
        await this.dataSource
          .getRepository(PaymentEntity)
          .update(order.id, { payment_status: PaymentStatus.PAID });
        if (error.status === 404) {
          throw new UnprocessableEntityException(
            'Este pedido não foi pago pelo PSP (ex.: pedido de demonstração) e não pode ser estornado por aqui.',
          );
        }
        throw new ConflictException(
          REFUSALS[error.code ?? ''] ?? 'O gateway recusou o estorno.',
        );
      }
      // sem resposta: fica "estornando"; o webhook ou a reconciliação decide
      this.logger.error(`Estorno do pedido ${order.id} sem resposta`, error);
      return;
    }

    await this.settle(order.gatewayReference!, result);
    if (result.status === 'failed') {
      throw new UnprocessableEntityException(
        `O gateway recusou o estorno${result.failureCode ? ` (${result.failureCode})` : ''}. O pedido continua pago.`,
      );
    }
  }

  private async view(orderId: number) {
    const order = await this.dataSource
      .getRepository(PaymentEntity)
      .findOneOrFail({
        where: { id: orderId },
        relations: ORDER_RELATIONS,
      });
    return toOrderView(order);
  }
}
