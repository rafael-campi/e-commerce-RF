import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { UserService } from '../../users/users.service';
import { UsersModule } from '../../users/users.module';
import { CreateUsers } from './user.seeder';
import { SeederService } from './seeder.service';

@Module({
  providers: [SeederService, UserService],
})
export class SeederModule {}