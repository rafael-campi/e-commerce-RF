import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
//import { UserSeeder } from './user.seeder';
import { UserEntity } from 'src/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  //providers: [UserSeeder],
 // exports: [UserSeeder]
})
export class SeederModule {}