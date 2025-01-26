import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { CartService } from './cart.service';

@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}

    @Post()
    create(@Body() createCartDto: CreateCartDto) {
        return this.cartService.create(createCartDto);
    }

    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.cartService.delete(id);
    }
}
