import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './users/entities/user.entity';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',  // O tipo do banco de dados
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [UserEntity],  // Coloque suas entidades aqui
      synchronize: true,  // Ativa a sincronização (Cuidado em produção!)
      logging: true,  // Ativa o log de consultas SQL
      migrations: ['./src/database/migrations/*.ts'], // Caminho para as migrações
    }),
    UsersModule
],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
