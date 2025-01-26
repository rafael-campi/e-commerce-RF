import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.SECRETE_KEY_JWT, // Use uma chave secreta forte ou armazene em variáveis de ambiente
      signOptions: { expiresIn: '60m' }, // Defina o tempo de expiração do token
    }),
    UsersModule, // Importando o módulo de usuários para o serviço de autenticação
  ],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
