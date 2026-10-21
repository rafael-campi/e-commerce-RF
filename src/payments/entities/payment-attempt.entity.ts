import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartEntity } from '../../cart/entities/cart.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { PaymentEntity } from './payment.entity';

/**
 * Tentativa de pagamento de um Carrinho (ver CONTEXT.md e docs/adr/0001).
 * Enquanto está pendente, o Estoque fica reservado e o Carrinho travado.
 */
@Entity('payment_attempts')
// um Carrinho tem no máximo uma Tentativa pendente: protege contra clique duplo
@Index('uq_payment_attempts_pending_cart', ['cart'], {
  unique: true,
  where: `"status" = 'pending'`,
})
export class PaymentAttemptEntity {
  @PrimaryGeneratedColumn({ unsigned: true })
  id: number;

  @ManyToOne(() => CartEntity, (cart) => cart.attempts, { onDelete: 'CASCADE' })
  cart: CartEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;

  @Column()
  method: string;

  // centavos, como o gateway recebe
  @Column({ type: 'int' })
  amountCents: number;

  @Column()
  status: string;

  // id do pagamento no gateway (ex.: "pay_..." no PSP); nulo até ele responder
  @Column({ type: 'varchar', nullable: true, unique: true })
  gatewayReference: string | null;

  @Column({ type: 'text', nullable: true })
  pixCopiaECola: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  // cartão: só bandeira e final, para o comprovante (o número fica no PSP)
  @Column({ type: 'varchar', nullable: true })
  cardBrand: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  // por que o gateway recusou (ex.: "insufficient_funds")
  @Column({ type: 'varchar', nullable: true })
  failureCode: string | null;

  // o Pedido, quando a Tentativa dá certo
  @ManyToOne(() => PaymentEntity, { nullable: true })
  payment: PaymentEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /** Chave de idempotência enviada ao gateway: repetir a chamada retoma a mesma cobrança. */
  get idempotencyKey(): string {
    return `cart-${this.cart.id}-attempt-${this.id}`;
  }
}
