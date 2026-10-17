import { PartialType } from '@nestjs/mapped-types';
import { IsIn, IsOptional } from 'class-validator';
import { UserType } from '../../enums/user-types.enum';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsIn([UserType.ADMIN, UserType.MODERATOR, UserType.USER])
  role?: number;
}
