import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/users.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserType } from '../enums/user-types.enum';

@Injectable()
export class UserTypesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se não houver roles definidos, permite o acesso
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { authorization } = request.headers;

    if (!authorization) {
      throw new UnauthorizedException('Token não fornecido');
    }

    try {
      const token = authorization.split(' ')[1];
      const decoded = this.jwtService.verify(token, {
        secret: process.env.SECRET_KEY_JWT,
      });

      const user = await this.userService.find(decoded.id);
      
      // Adiciona o usuário ao request para uso posterior
      request.user = user;

      // Verifica se o usuário tem a role necessária
      if (!requiredRoles.includes(user.role)) {
        throw new ForbiddenException(
          `Esta rota requer um dos seguintes níveis de acesso: ${requiredRoles.join(', ')}`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
} 