import { Factory, Seeder } from 'typeorm-seeding';
import { Connection } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { Role } from '../../enums/role.enum';

export default class CreateUsers implements Seeder {
  public async run(factory: Factory, connection: Connection): Promise<void> {
    await connection
      .createQueryBuilder()
      .insert()
      .into(UserEntity)
      .values([
        { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', password: 'password123', role: Role.ADMIN },
        { firstName: 'Jane', lastName: 'Doe', email: 'jane.doe@example.com', password: 'password123', role: Role.USER },
        { firstName: 'Jim', lastName: 'Beam', email: 'jim.beam@example.com', password: 'password123', role: Role.USER },
      ])
      .execute();
  }
}