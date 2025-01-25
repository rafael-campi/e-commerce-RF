import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProductsService } from './products.service';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductDto } from './dto/create-product.dto';

@Controller('products')
export class ProductsController {
    constructor(private readonly productService: ProductsService) {}
      
        @Post()
        create(@Body() createProductDto: CreateProductDto) {
          return this.productService.create(createProductDto);
        }
      
        @Get()
        findAll() {
          return this.productService.findAll();
        }
      
        @Get(':id')
        findOne(@Param('id') id: number) {
          return this.productService.find(id);
        }
      
        @Patch(':id')
        update(@Param('id') id: number, @Body() updateProductDto: UpdateProductDto) {
          return this.productService.update(id, updateProductDto);
        }
      
        @Delete(':id')
        delete(@Param('id') id: number) {
          return this.productService.delete(id);
        }
}
