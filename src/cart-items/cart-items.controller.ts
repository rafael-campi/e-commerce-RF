import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CartItemsService } from './cart-items.service';
import { UpdateCartItemsDto } from './dto/update-cart-items.dto';
import { CreateCartItemDto } from './dto/create-cart-items.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('cart-items')
export class CartItemsController {
    constructor(private readonly cardItemsService: CartItemsService) {}

        @Post()
        create(@Body() createCarItemtDto: CreateCartItemDto) {
          return this.cardItemsService.create(createCarItemtDto);
        }
      
        @Get()
        findAll() {
          return this.cardItemsService.findAll();
        }
      
        @Get(':id')
        findOne(@Param('id') id: number) {
          return this.cardItemsService.find(id);
        }
      
        @Patch(':id')
        update(@Param('id') id: number, @Body() updateCartItemsDto: UpdateCartItemsDto) {
          return this.cardItemsService.update(id, updateCartItemsDto);
        }
      
        @Delete(':id')
        delete(@Param('id') id: number) {
          return this.cardItemsService.delete(id);
        }
}
