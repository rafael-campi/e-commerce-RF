import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartItemsDto } from '../cart-items/dto/update-cart-items.dto';
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

  @Put(':id/items/:productId')
  setItem(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: UpdateCartItemsDto,
  ) {
    return this.cartService.setItem(id, productId, body.quantity, req.user);
  }

  @Delete(':id/items/:productId')
  removeItem(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.cartService.removeItem(id, productId, req.user);
  }
}
