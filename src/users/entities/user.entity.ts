import { CartEntity } from '../../cart/entities/cart.entity';
import { UserType } from '../../enums/user-types.enum';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PaymentEntity } from '../../payments/entities/payment.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn({
    unsigned: true,
  })
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({
    default: UserType.USER,
  })
  role: number;

  @OneToMany(() => CartEntity, (cart) => cart.user)
  carts: CartEntity[];

}
