import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module'; // Ajuste o caminho
import { SeederService } from './seeder.service'; // Ajuste o caminho

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(SeederModule);

  const seederService = app.get(SeederService); // Pegando o SeederService

  try {
    await seederService.run(); // Executando a seed
    console.log('Seed completed successfully');
  } catch (error) {
    console.error('Seed failed', error);
  }

  await app.close(); // Fechando o contexto da aplicação
}

bootstrap();
