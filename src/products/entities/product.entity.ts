import { OrderItemEntity } from 'src/order-items/entities/order-item.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('products')
export class ProductEntity { 
  @PrimaryGeneratedColumn({
    unsigned:true
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


  @OneToMany(() => OrderItemEntity, (orderItem) => orderItem.product, { onDelete: 'CASCADE' })
  orderItems: OrderItemEntity[];
}
