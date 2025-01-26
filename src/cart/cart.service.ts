import { Injectable } from '@nestjs/common';
import { CartEntity } from './entities/cart.entity';
import { Repository } from 'typeorm';
import { CreateCartDto } from './dto/create-cart.dto';
import { ProductEntity } from '../products/entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductsService } from '../products/products.service';
import { UserService } from '../users/users.service';

@Injectable()
export class CartService {
    constructor(
            @InjectRepository(CartEntity)
            private cartRepository: Repository<CartEntity>,
            private userService: UserService,
            private productService: ProductsService,
          ) {}

          async create(data: CreateCartDto) {
            // Find the user by the user_id from the data
            const user = await this.userService.find( data.user_id );
        
            if (!user) {
              throw new Error('User not found');
            }
        
            // Create a new cart and associate it with the found user
            const cart = this.cartRepository.create({
              user, // Directly associating the user with the cart
            });
        
            // Save the cart with the user association
            return this.cartRepository.save(cart);
          }

    async delete(id: number) {
    
        await this.cartRepository.delete(id);
    
        return true;
      }
}
