import { PaymentEntity } from '../../payments/entities/payment.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';

@Entity('orders')
export class OrderEntity { 
  @PrimaryGeneratedColumn({
    unsigned:true
  })
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_price: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.orders, { onDelete: 'CASCADE' })
  user: UserEntity;

  @ManyToOne(() => PaymentEntity, (payment) => payment.orders, { onDelete: 'CASCADE' })
  payment: PaymentEntity;
  
}
