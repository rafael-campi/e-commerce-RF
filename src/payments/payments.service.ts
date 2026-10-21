import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaymentEntity } from './entities/payment.entity';
import { PaymentAttemptEntity } from './entities/payment-attempt.entity';
import { UserEntity } from '../users/entities/user.entity';
import { CartEntity } from '../cart/entities/cart.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { ProductsService } from '../products/products.service';
import {
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentStatus,
} from '../enums/payment.enums';
import {
  GatewayStatus,
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './gateway/payment-gateway';
import { ORDER_RELATIONS, toOrderView } from './order-view';
import { OrderRefundsService } from './order-refunds.service';

// sem referência do gateway depois disso, o processo caiu antes de cobrar
const ABANDONED_AFTER_MS = 2 * 60_000;
// folga para o webhook de expiração chegar antes de perguntarmos ao gateway
const RECONCILE_GRACE_MS = 5 * 60_000;

// o que dizer ao cliente quando o banco emissor recusa o cartão
const FAILURE_MESSAGES: Record<string, string> = {
  card_declined: 'O banco emissor recusou o cartão.',
  insufficient_funds: 'O cartão não tem saldo ou limite suficiente.',
  expired_card: 'O banco informou que o cartão está vencido.',
  processing_error:
    'A operadora não conseguiu processar o cartão. Tente de novo.',
};

/** Evento como o PSP entrega em POST /webhooks/payments (docs/adr/0001). */
export interface GatewayEvent {
  id: string;
  type: string;
  // payment.*: o pagamento; refund.*: o estorno, com o pagamento em paymentId
  data: {
    object: {
      id: string;
      status: GatewayStatus;
      paymentId?: string;
    };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentEntity)
    private paymentRepository: Repository<PaymentEntity>,
    @InjectRepository(PaymentAttemptEntity)
    private attemptRepository: Repository<PaymentAttemptEntity>,
    private dataSource: DataSource,
    private cartService: CartService,
    private productsService: ProductsService,
    @Inject(PAYMENT_GATEWAY) private gateway: PaymentGateway,
    private orderRefunds: OrderRefundsService,
  ) {}

  /**
   * Paga um Carrinho: abre (ou retoma) a Tentativa de pagamento e pede a
   * cobrança ao gateway. Aprovada na hora, já vira Pedido; pendente (Pix),
   * vira Pedido quando o webhook do gateway confirmar.
   */
  async createPayment(
    paymentMethod: PaymentMethod,
    cartId: number,
    user: UserEntity,
    card: { token?: string; installments?: number } = {},
  ) {
    if (
      paymentMethod === PaymentMethod.CREDIT_CARD &&
      this.gateway.requiresCardToken &&
      !card.token
    ) {
      throw new BadRequestException('Informe os dados do cartão.');
    }
    const cart = await this.cartService.findOwned(cartId, user);

    if (!cart) {
      throw new NotFoundException(`O carrinho ${cartId} não existe.`);
    }
    if (cart.payment) {
      throw new ConflictException(`O carrinho ${cartId} já foi pago.`);
    }

    let attempt = await this.findPendingAttempt(cart.id);
    if (attempt && attempt.method !== paymentMethod) {
      throw new ConflictException(
        `O carrinho ${cartId} já tem um pagamento em andamento por outro método. Cancele-o para trocar.`,
      );
    }
    attempt ??= await this.openAttempt(cart, paymentMethod, user);

    // sem referência: primeira chamada, ou o processo caiu antes da resposta
    // (a mesma chave de idempotência retoma a mesma cobrança)
    if (!attempt.gatewayReference) {
      await this.requestFromGateway(attempt, card);
    }
    return this.toAttemptView(await this.loadAttempt({ id: attempt.id }));
  }

  /**
   * O que o checkout precisa para tokenizar o cartão no navegador, direto
   * no PSP; null quando o gateway não pede cartão (gateway local).
   */
  checkoutConfig() {
    const publishableKey = process.env.PSP_PUBLISHABLE_KEY;
    if (!this.gateway.requiresCardToken || !publishableKey) {
      return { card: null };
    }
    // como o navegador chega ao PSP: /psp (proxy do Vite) em dev, a mesma
    // origem atrás do api-gateway em produção
    return {
      card: { publishableKey, pspUrl: process.env.PSP_PUBLIC_URL ?? '/psp' },
    };
  }

  async getAttempt(id: number, user: UserEntity) {
    const attempt = await this.loadAttempt({ id, user: { id: user.id } });
    if (!attempt) {
      throw new NotFoundException(`A tentativa de pagamento ${id} não existe.`);
    }
    return this.toAttemptView(attempt);
  }

  /** Idempotente. Se o cliente pagou antes do cancelamento, vale o pagamento. */
  async cancelAttempt(id: number, user: UserEntity) {
    const attempt = await this.loadAttempt({ id, user: { id: user.id } });
    if (!attempt) {
      throw new NotFoundException(`A tentativa de pagamento ${id} não existe.`);
    }
    if (attempt.status !== PaymentAttemptStatus.PENDING) {
      return this.toAttemptView(attempt);
    }

    if (!attempt.gatewayReference) {
      await this.settle({ id }, 'canceled');
    } else {
      let result;
      try {
        result = await this.gateway.cancelPayment(attempt.gatewayReference);
      } catch (error) {
        this.logger.error(
          `Falha ao cancelar ${attempt.gatewayReference}`,
          error,
        );
        throw new BadGatewayException('Falha ao cancelar o pagamento.');
      }
      await this.settle({ id }, result.status);
    }
    return this.toAttemptView(await this.loadAttempt({ id }));
  }

  /**
   * Aplica um evento do gateway. Cada evento é aplicado uma única vez, na
   * mesma transação que muda a Tentativa (a entrega é "pelo menos uma vez").
   */
  async handleGatewayEvent(event: GatewayEvent) {
    await this.dataSource.transaction(async (manager) => {
      const inserted: unknown[] = await manager.query(
        `INSERT INTO processed_webhook_events ("eventId", "type")
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING "eventId"`,
        [event.id, event.type],
      );
      if (inserted.length === 0) return; // repetido

      // estorno de um Pedido: refund.succeeded / refund.failed
      if (event.type.startsWith('refund.')) {
        const { id, status, paymentId } = event.data.object;
        if (paymentId && (status === 'succeeded' || status === 'failed')) {
          await this.orderRefunds.settle(
            paymentId,
            { status, reference: id },
            manager,
          );
        }
        return;
      }
      // repasses (payout.*) são entre o PSP e a conta da loja: não mudam Pedidos
      if (!event.type.startsWith('payment.')) return;

      const { id: reference, status } = event.data.object;
      const attempt = await this.settle(
        { gatewayReference: reference },
        status,
        manager,
      );
      if (!attempt) {
        // ex.: cobrança criada por uma chamada que deu erro do nosso lado
        this.logger.warn(
          `Evento ${event.id} para pagamento desconhecido ${reference}`,
        );
      }
    });
  }

  /**
   * Fecha o que o webhook não fechou: Tentativas pendentes além do prazo são
   * conferidas no gateway; as que nunca chegaram a ele são encerradas.
   */
  async reconcile(now = new Date()) {
    const stale = await this.attemptRepository
      .createQueryBuilder('a')
      .where('a.status = :pending', { pending: PaymentAttemptStatus.PENDING })
      .andWhere(
        new Brackets((q) =>
          q
            .where('a.gatewayReference IS NULL AND a.createdAt < :abandoned', {
              abandoned: new Date(now.getTime() - ABANDONED_AFTER_MS),
            })
            .orWhere('a.expiresAt < :overdue', {
              overdue: new Date(now.getTime() - RECONCILE_GRACE_MS),
            }),
        ),
      )
      .getMany();

    for (const attempt of stale) {
      try {
        if (!attempt.gatewayReference) {
          await this.settle({ id: attempt.id }, 'failed');
        } else {
          const { status } = await this.gateway.getPayment(
            attempt.gatewayReference,
          );
          await this.settle({ id: attempt.id }, status);
        }
      } catch (error) {
        this.logger.error(
          `Falha ao reconciliar a tentativa ${attempt.id}`,
          error,
        );
      }
    }
    return stale.length;
  }

  // Pedido = carrinho pago (ver CONTEXT.md)
  async findOrders() {
    const payments = await this.paymentRepository.find({
      relations: ORDER_RELATIONS,
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    return payments.map((payment) => toOrderView(payment));
  }

  private findPendingAttempt(cartId: number) {
    return this.attemptRepository.findOne({
      where: { cart: { id: cartId }, status: PaymentAttemptStatus.PENDING },
      relations: ['cart', 'user'],
    });
  }

  /** Reserva o Estoque e registra a Tentativa; o Carrinho fica travado. */
  private async openAttempt(
    cart: CartEntity,
    method: PaymentMethod,
    user: UserEntity,
  ) {
    // soma em centavos para não acumular erro de ponto flutuante
    const amountCents = cart.cartItem.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.product.price) * 100) * item.quantity,
      0,
    );
    const reservation = cart.cartItem.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
    }));
    await this.productsService.reserveStock(reservation);

    try {
      return await this.attemptRepository.save(
        this.attemptRepository.create({
          cart,
          user,
          method,
          amountCents,
          status: PaymentAttemptStatus.PENDING,
        }),
      );
    } catch (error) {
      await this.productsService.releaseStock(reservation);
      // clique duplo: a outra requisição abriu a Tentativa primeiro
      if (
        error instanceof QueryFailedError &&
        error.driverError?.constraint === 'uq_payment_attempts_pending_cart'
      ) {
        const winner = await this.findPendingAttempt(cart.id);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private async requestFromGateway(
    attempt: PaymentAttemptEntity,
    card: { token?: string; installments?: number },
  ) {
    let result;
    try {
      result = await this.gateway.requestPayment({
        amountCents: attempt.amountCents,
        method: attempt.method,
        idempotencyKey: attempt.idempotencyKey,
        description: `Loja Prateleira · Carrinho #${attempt.cart.id}`,
        metadata: {
          cartId: String(attempt.cart.id),
          attemptId: String(attempt.id),
        },
        ...(card.token
          ? {
              card: { token: card.token, installments: card.installments ?? 1 },
            }
          : {}),
      });
    } catch (error) {
      // o gateway não registrou a cobrança (ou não há como o cliente pagá-la:
      // nunca viu o QR Code): libera o Estoque e o Carrinho. Se o PSP não
      // ouvir a operadora de cartão, ele responde "pending", não erro.
      this.logger.error(
        `Falha no gateway para a tentativa ${attempt.id}`,
        error,
      );
      await this.settle({ id: attempt.id }, 'failed');
      throw new BadGatewayException('Falha ao processar o pagamento.');
    }

    await this.attemptRepository.update(
      { id: attempt.id, status: PaymentAttemptStatus.PENDING },
      {
        gatewayReference: result.reference,
        pixCopiaECola: result.pix?.copiaECola ?? null,
        cardBrand: result.card?.brand ?? null,
        cardLast4: result.card?.last4 ?? null,
        failureCode: result.failureCode,
        expiresAt: result.expiresAt,
      },
    );
    const settled = await this.settle({ id: attempt.id }, result.status);
    if (settled?.status === PaymentAttemptStatus.FAILED) {
      throw new HttpException(
        failureMessage(result.failureCode),
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  /**
   * Leva a Tentativa ao estado final que o gateway informou, com a linha
   * travada (webhook, cancelamento e reconciliação podem chegar juntos).
   * Só uma Tentativa pendente muda; as demais ficam como estão.
   */
  private async settle(
    where: FindOptionsWhere<PaymentAttemptEntity>,
    status: GatewayStatus,
    manager?: EntityManager,
  ): Promise<PaymentAttemptEntity | null> {
    if (!manager) {
      return this.dataSource.transaction((m) => this.settle(where, status, m));
    }

    // FOR UPDATE não combina com os LEFT JOINs das relações: trava, depois carrega
    const locked = await manager.findOne(PaymentAttemptEntity, {
      where,
      lock: { mode: 'pessimistic_write' },
    });
    if (!locked) return null;
    const attempt = await manager.findOneOrFail(PaymentAttemptEntity, {
      where: { id: locked.id },
      relations: ['cart', 'cart.cartItem', 'cart.cartItem.product', 'user'],
    });
    if (
      attempt.status !== PaymentAttemptStatus.PENDING ||
      status === 'pending'
    ) {
      return attempt;
    }

    if (status === 'succeeded') {
      // o Estoque já saiu na reserva; aqui nasce o Pedido
      const payment = await manager.save(
        manager.create(PaymentEntity, {
          amount: (attempt.amountCents / 100).toFixed(2),
          payment_method: attempt.method,
          payment_status: PaymentStatus.PAID,
          gatewayReference: attempt.gatewayReference,
          user: attempt.user,
        }),
      );
      await manager.update(CartEntity, attempt.cart.id, { payment });
      await manager.update(PaymentAttemptEntity, attempt.id, {
        status: PaymentAttemptStatus.SUCCEEDED,
        payment,
      });
      attempt.status = PaymentAttemptStatus.SUCCEEDED;
    } else {
      for (const { product, quantity } of attempt.cart.cartItem) {
        await manager.increment(
          ProductEntity,
          { id: product.id },
          'stock',
          quantity,
        );
      }
      const final = status as PaymentAttemptStatus;
      await manager.update(PaymentAttemptEntity, attempt.id, { status: final });
      attempt.status = final;
    }
    return attempt;
  }

  private loadAttempt(where: FindOptionsWhere<PaymentAttemptEntity>) {
    return this.attemptRepository.findOne({
      where,
      relations: ['cart', 'user', 'payment'],
    });
  }

  private toAttemptView(attempt: PaymentAttemptEntity) {
    const { payment } = attempt;
    return {
      id: attempt.id,
      cartId: attempt.cart.id,
      status: attempt.status,
      method: attempt.method,
      amount: (attempt.amountCents / 100).toFixed(2),
      expiresAt: attempt.expiresAt,
      pix: attempt.pixCopiaECola ? { copiaECola: attempt.pixCopiaECola } : null,
      card: attempt.cardLast4
        ? { brand: attempt.cardBrand, last4: attempt.cardLast4 }
        : null,
      failure: attempt.failureCode
        ? {
            code: attempt.failureCode,
            message: failureMessage(attempt.failureCode),
          }
        : null,
      // o Pedido, quando a Tentativa deu certo
      order: payment && {
        id: payment.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        payment_status: payment.payment_status,
        gatewayReference: payment.gatewayReference,
        cartId: attempt.cart.id,
        userId: attempt.user.id,
        createdAt: payment.createdAt,
      },
    };
  }
}

function failureMessage(code: string | null) {
  return (code && FAILURE_MESSAGES[code]) ?? 'O pagamento foi recusado.';
}
