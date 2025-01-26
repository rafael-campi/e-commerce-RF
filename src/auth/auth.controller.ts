import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthLoginDTO } from './dto/auth-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: AuthLoginDTO) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return this.authService.login(user); // Retorna o JWT após o login
  }
}
