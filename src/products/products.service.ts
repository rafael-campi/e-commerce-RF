import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductEntity } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UserEntity } from 'src/users/entities/user.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private productRepository: Repository<ProductEntity>,
  ) {}

  private async assertNameAvailable(name: string | undefined, exceptId?: number) {
    if (
      name !== undefined &&
      (await this.productRepository.exist({
        where: exceptId === undefined ? { name } : { name, id: Not(exceptId) },
      }))
    ) {
      throw new ConflictException(`Já existe um produto chamado "${name}".`);
    }
  }

  async create(data: CreateProductDto) {
    await this.assertNameAvailable(data.name);

    const product = this.productRepository.create({
      ...data,
      price: String(data.price),
    });

    const saved = await this.productRepository.save(product);

    return this.find(saved.id);
  }

  async findAll() {
    return this.productRepository.find();
  }

  async find(id: number) {
    await this.exists(id);

    return this.productRepository.findOneBy({
      id,
    });
  }

  async update(
    id: number,
    { name, description, price, stock }: UpdateProductDto,
  ) {
    await this.assertNameAvailable(name, id);

    await this.productRepository.update(id, {
      name,
      description,
      price: price === undefined ? undefined : String(price),
      stock,
    });

    return this.find(id);
  }

  async updatePartial(
    id: number,
    { name, description, price, stock }: UpdateProductDto,
  ) {
    await this.exists(id);

    const data: any = {};
    data.name = name;
    data.description = description;
    data.price = price === undefined ? undefined : String(price);
    data.stock = stock;

    await this.productRepository.update(id, data);

    return this.find(id);
  }

  async delete(id: number) {
    await this.exists(id);

    await this.productRepository.delete(id);

    return true;
  }

  async exists(id: number) {
    if (
      !(await this.productRepository.exist({
        where: {
          id,
        },
      }))
    ) {
      throw new NotFoundException(`O produto ${id} não existe.`);
    }
  }
}
