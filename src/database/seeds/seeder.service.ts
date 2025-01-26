import { Injectable } from '@nestjs/common';
import { UserService } from '../../users/users.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SeederService {
  constructor(private readonly userService: UserService) {}

  async run() {
    const users = [
      {
        email: 'admin@example.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: 1, // ROLE.ADMIN
      },
      {
        email: 'user@example.com',
        password: 'password123',
        firstName: 'Regular',
        lastName: 'User',
        role: 0, // ROLE.USER
      },
    ];

    // Verificar se os usuários já existem
    const existingUsers = await this.userService.findAll();
    if (existingUsers.length > 0) {
      console.log('Users already seeded');
      return;
    }

    // Criptografar senhas
    const salt = await bcrypt.genSalt(10);
    for (const user of users) {
      user.password = await bcrypt.hash(user.password, salt);
      await this.userService.create(user);  // Criar o usuário
    }

    console.log('User seeding completed');
  }
}
