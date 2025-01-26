import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../users/entities/user.entity';
import { UserService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
// O serviço de usuários para buscar os usuários no banco

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService, // Serviço de usuários para fazer a busca
    private jwtService: JwtService, // Serviço de JWT para criar o token
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email); // Função que você irá criar no UserService
    if (user && bcrypt.compareSync(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: UserEntity) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload), // Geração do token JWT
    };
  }
}
