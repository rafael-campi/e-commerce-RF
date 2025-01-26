import { InjectRepository } from "@nestjs/typeorm";
import { CartItemEntity } from "./entities/card-items.entity";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { CreateCartItemDto } from "./dto/create-cart-items.dto";
import { UpdateCartItemsDto } from "./dto/update-cart-items.dto";

@Injectable()
export class CartItemsService {
    constructor(
            @InjectRepository(CartItemEntity)
            private cartItemRepository: Repository<CartItemEntity>,
    ) {}
    
    async create(cartItemData: Partial<CartItemEntity>) {
        const newCartItem = this.cartItemRepository.create(cartItemData);
        await this.cartItemRepository.save(newCartItem);
        return newCartItem;
    }
      
    
    async findAll() {
            return this.cartItemRepository.find();
          }
        
          async find(id: number) {
            await this.exists(id);
        
            return this.cartItemRepository.findOneBy({
              id,
            });
          }
        
          async update(
            id: number,
            data: CreateCartItemDto,
          ) {
            
        
            await this.cartItemRepository.update(id,data);
        
            return this.find(id);
          }
        
          async updatePartial(
            id: number,
            data: UpdateCartItemsDto,
          ) {
            await this.exists(id);

            await this.cartItemRepository.update(id, data);
        
            return this.find(id);
          }
        
          async delete(id: number) {
            await this.exists(id);
        
            await this.cartItemRepository.delete(id);
        
            return true;
          }
        
          async exists(id: number) {
            if (
              !(await this.cartItemRepository.exist({
                where: {
                  id,
                },
              }))
            ) {
              throw new NotFoundException(`O produto ${id} não existe.`);
            }
          }
}
