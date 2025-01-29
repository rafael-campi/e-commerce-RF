import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: CreateUserDto) {
    if (
      await this.usersRepository.exist({
        where: {
          email: data.email,
        },
      })
    ) {
      throw new BadRequestException('Este e-mail já está sendo usado.');
    }

    const salt = await bcrypt.genSalt();

    data.password = await bcrypt.hash(data.password, salt);

    const user = this.usersRepository.create(data);

    return this.usersRepository.save(user);
  }

  async findAll() {
    return this.usersRepository.find();
  }

  async find(id: number) {
    await this.exists(id);

    return this.usersRepository.findOneBy({
      id,
    });
  }

  async findByEmail(searchEmail: string) {
    return this.usersRepository.findOneBy({
      email: searchEmail,
    });
  }

  async update(
    id: number,
    { email, firstName, lastName, password, role }: UpdateUserDto,
  ) {
    await this.exists(id);

    const salt = await bcrypt.genSalt();

    password = await bcrypt.hash(password, salt);

    await this.usersRepository.update(id, {
      email,
      firstName,
      lastName,
      password,
      role,
    });

    return this.find(id);
  }

  async updatePartial(
    id: number,
    { email, firstName, lastName, password, role }: UpdateUserDto,
  ) {
    await this.exists(id);

    const data: any = {};

    if (email) {
      data.email = email;
    }

    if (firstName) {
      data.firstName = firstName;
    }

    if (password) {
      const salt = await bcrypt.genSalt();
      data.password = await bcrypt.hash(password, salt);
    }

    if (role) {
      data.role = role;
    }

    await this.usersRepository.update(id, data);

    return this.find(id);
  }

  async delete(id: number) {
    await this.exists(id);

    await this.usersRepository.delete(id);

    return true;
  }

  async exists(id: number) {
    if (
      !(await this.usersRepository.exist({
        where: {
          id,
        },
      }))
    ) {
      throw new NotFoundException(`O usuário ${id} não existe.`);
    }
  }
}
