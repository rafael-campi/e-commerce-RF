// seed.ts
import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module'; // Ajuste o caminho conforme necessário
import  CreateUsers  from './user.seeder'; // Ajuste o caminho conforme necessário

async function bootstrap() {
  /*const app = await NestFactory.create(SeederModule);

  const userSeeder = app.get(CreateUsers); // Injetando o seeder
  
  try {
    await userSeeder.run(); // Executando o método run do seeder
    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed', error);
  }*/

  //await app.close(); // Fechando a aplicação após o seeding
}

bootstrap();
