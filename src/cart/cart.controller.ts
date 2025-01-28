import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
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
