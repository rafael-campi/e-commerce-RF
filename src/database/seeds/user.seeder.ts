import { Injectable } from '@nestjs/common';
import { UserService } from '../../users/users.service'; // Ajuste o caminho
import * as bcrypt from 'bcryptjs';

@Injectable()
export class CreateUsers {
  constructor(private readonly userService: UserService) {}

  async run() {
    const existingUsers = await this.userService.findAll(); // Ou outro método que você tenha no UserService
    if (existingUsers.length > 0) {
      console.log('Users already seeded');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const users = [
      {
        email: 'admin@example.com',
        password: await bcrypt.hash('password123', salt),
        firstName: 'Admin',
        lastName: 'User',
        role: 1, // ROLE.ADMIN
      },
      {
        email: 'user@example.com',
        password: await bcrypt.hash('password123', salt),
        firstName: 'Regular',
        lastName: 'User',
        role: 0, // ROLE.USER
      },
    ];

    for (const user of users) {
      await this.userService.create(user); // Usando o UserService para criar os usuários
    }

    console.log('User seeding completed');
  }
}
