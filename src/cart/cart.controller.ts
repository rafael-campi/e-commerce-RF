import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { CartService } from './cart.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  findByUser(@Headers() header) {
    return this.cartService.findByUser(header.user);
  }


  @Post()
  create(@Headers() header, @Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto, header.user);
  }

  @Delete(':id')
  delete(@Param('id') id: number) {
    return this.cartService.delete(id);
  }
}
