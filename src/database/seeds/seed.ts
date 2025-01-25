import { NestFactory } from '@nestjs/core';
import { SeederModule } from './seeder.module';
//import { UserSeeder } from './user.seeder';

async function bootstrap() {
  const app = await NestFactory.create(SeederModule);
  
  //const userSeeder = app.get(UserSeeder);
  /* 
  try {
    await userSeeder.seed();
    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Seeding failed', error);
  } */
  
  await app.close();
}

bootstrap();