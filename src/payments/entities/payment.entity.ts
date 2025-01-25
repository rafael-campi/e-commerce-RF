import { CartItemEntity } from "src/cart-items/entities/card-items.entity";
import { OrderEntity } from "src/orders/entities/order.entity";
import { UserEntity } from "src/users/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity('payments')
export class PaymentEntity {
    @PrimaryGeneratedColumn({
    unsigned:true
  })
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string;

  @Column()
  payment_method: string;

  @Column()
  payment_status: string;

  @ManyToOne(() => UserEntity, (user) => user.payments, { onDelete: 'CASCADE' })
  user: UserEntity;

  @OneToMany(() => CartItemEntity, (cartItem) => cartItem.cart, { onDelete: 'CASCADE' })
  cartItem: CartItemEntity[];

  @OneToMany(() => OrderEntity, (order) => order.payment, { onDelete: 'CASCADE' })
  orders: OrderEntity[];

  @CreateDateColumn()
  createdAt: Date;

}
