import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../src/users/entities/user.entity';
import { UserType } from '../../src/enums/user-types.enum';

export interface TestUser {
  id: number;
  email: string;
  password: string;
  role: number;
}

let counter = 0;

export async function createUser(
  app: INestApplication,
  overrides: Partial<{ email: string; password: string; role: UserType }> = {},
): Promise<TestUser> {
  const email = overrides.email ?? `user${++counter}@example.com`;
  const password = overrides.password ?? 'password123';
  const role = overrides.role ?? UserType.USER;

  const repository = app.get(DataSource).getRepository(UserEntity);
  const saved = await repository.save(
    repository.create({
      email,
      password: await bcrypt.hash(password, 10),
      role,
    }),
  );

  return { id: saved.id, email, password, role };
}

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return response.body.access_token;
}
