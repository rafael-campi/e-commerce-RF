import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationArguments } from 'class-validator';
import { ProductsService } from '../products.service';

@ValidatorConstraint({ async: true })
@Injectable()
export class ProductExists implements ValidatorConstraintInterface {
  constructor(private readonly productService: ProductsService) {}

  async validate(productId: number, args: ValidationArguments) {
    const product = await this.productService.find(productId);
    return !!product;
  }

  defaultMessage(args: ValidationArguments) {
    return `Product with ID ${args.value} does not exist`;
  }
}
