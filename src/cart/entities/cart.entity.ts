import { CartItemEntity } from '../../cart-items/entities/card-items.entity';
import { UserEntity } from '../../users/entities/user.entity';
import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('carts')
export class CartEntity {
  @PrimaryGeneratedColumn({
    unsigned: true,
  })
  id: number;

  @ManyToOne(() => UserEntity, (user) => user.carts, { onDelete: 'CASCADE' })
  user: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => CartItemEntity, (cartItem) => cartItem.cart)
  cartItem: CartItemEntity[];
}
