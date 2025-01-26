import { CartEntity } from "../../cart/entities/cart.entity";
import { UserEntity } from "../../users/entities/user.entity";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('card_items')
export class CartItemEntity {
    @PrimaryGeneratedColumn({
    unsigned:true
  })
  id: number;

  @ManyToOne(() => CartEntity, (cart) => cart.cartItem, { onDelete: 'CASCADE' })
  cart: CartEntity;

  @Column({ nullable: false })
  quantity: number;
  

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
