import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
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
  findByUser(@Request() req) {
    return this.cartService.findByUser(req.user);
  }

  @Post()
  create(@Request() req, @Body() createCartDto: CreateCartDto) {
    return this.cartService.create(createCartDto, req.user);
  }

  @Delete(':id')
  delete(@Request() req, @Param('id', ParseIntPipe) id: number) {
    return this.cartService.delete(id, req.user);
  }
}
