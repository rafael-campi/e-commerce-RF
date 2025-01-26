import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class AuthJwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extraí o JWT do cabeçalho de autorização
      ignoreExpiration: false, // Não ignora a expiração do token
      secretOrKey: 'SECRET_KEY', // A chave secreta usada para validar o token
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email }; // Retorna o usuário baseado no payload do token
  }
}
