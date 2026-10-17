import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProductEntity } from './entities/product.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, QueryFailedError, Repository } from 'typeorm';
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

  /**
   * Reserva o estoque de todos os itens ou de nenhum. Cada baixa é um UPDATE
   * condicional, então duas compras simultâneas não vendem a mesma unidade.
   */
  async reserveStock(items: { productId: number; quantity: number }[]) {
    const reserved: typeof items = [];

    for (const item of items) {
      const result = await this.productRepository
        .createQueryBuilder()
        .update()
        .set({ stock: () => 'stock - :quantity' })
        .where('id = :id AND (stock IS NULL OR stock >= :quantity)', {
          id: item.productId,
          quantity: item.quantity,
        })
        .execute();

      if (!result.affected) {
        await this.releaseStock(reserved);
        throw new ConflictException(
          `Estoque insuficiente para o produto ${item.productId}.`,
        );
      }
      reserved.push(item);
    }
  }

  async releaseStock(items: { productId: number; quantity: number }[]) {
    for (const { productId, quantity } of items) {
      await this.productRepository.increment({ id: productId }, 'stock', quantity);
    }
  }

  async delete(id: number) {
    await this.exists(id);

    try {
      await this.productRepository.delete(id);
    } catch (error) {
      // 23503 = foreign_key_violation: o produto está em algum carrinho
      if (error instanceof QueryFailedError && error.driverError?.code === '23503') {
        throw new ConflictException(
          `O produto ${id} está em carrinhos e não pode ser removido.`,
        );
      }
      throw error;
    }

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
