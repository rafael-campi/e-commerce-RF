/* import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from 'src/users/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserSeeder {
  constructor(
    @InjectRepository(UserEntity)
  ) {}

  async seed() {
    // Clear existing users (optional)
    /* await this.userRepository.clear();

    // Seed users
    const users = [
      {
        email: 'admin@example.com',
        password: await this.hashPassword('admin123'),
        firstName: 'Admin',
        lastName: 'User'
      },
      {
        email: 'user@example.com',
        password: await this.hashPassword('user123'),
        firstName: 'Regular',
        lastName: 'User'
      }
    ];

    // Save users
    await this.userRepository.save(users);
    console.log('Users seeded successfully');
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  } 
  }
} */