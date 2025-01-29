import { ProductEntity } from '../../products/entities/product.entity';
import { UserEntity } from '../../users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';

@Entity('order-items')
export class OrderItemEntity {
  @PrimaryGeneratedColumn({
    unsigned: true,
  })
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: string;

  @Column({ nullable: true })
  stock: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.orderItems, {
    onDelete: 'CASCADE',
  })
  user: UserEntity;

  @ManyToOne(() => ProductEntity, (product) => product.orderItems, {
    onDelete: 'CASCADE',
  })
  product: ProductEntity;
}
