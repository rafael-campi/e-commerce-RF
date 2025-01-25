import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import CreateUsers from './user.seeder';
import { UserEntity } from '../../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [CreateUsers],
  exports: [CreateUsers]
})
export class SeederModule {}