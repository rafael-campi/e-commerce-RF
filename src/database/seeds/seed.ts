import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ProductEntity } from '../../products/entities/product.entity';
import { UserType } from '../../enums/user-types.enum';

// Dados da Loja Prateleira (mesmos do protótipo). Idempotente: usuários pelo
// e-mail e produtos pelo nome; o que já existe não é alterado.
const USERS = [
  {
    email: 'admin@prateleira.com',
    firstName: 'Helena',
    lastName: 'Prado',
    role: UserType.ADMIN,
  },
  {
    email: 'cliente@prateleira.com',
    firstName: 'Marcos',
    lastName: 'Teixeira',
    role: UserType.USER,
  },
];
const PASSWORD = '123456';

const PRODUCTS = [
  { name: 'Fone Bluetooth Aura', description: 'Fone over-ear com cancelamento ativo de ruído, modo ambiente e até 30 horas de reprodução. Dobra para caber na mochila e acompanha cabo USB-C e estojo rígido.', price: '349.90', stock: 24 },
  { name: 'Cafeteira Prensa Francesa 600 ml', description: 'Prepara até 4 xícaras de café encorpado em 4 minutos. Jarra de vidro borossilicato resistente ao calor e filtro duplo de aço inox que segura o pó fino.', price: '129.90', stock: 3 },
  { name: 'Luminária de Mesa Arco', description: 'Braço articulado em alumínio, base com peso para não tombar e LED com três temperaturas de cor e cinco níveis de intensidade. Consumo de 7 W.', price: '219.00', stock: 0 },
  { name: 'Mochila Urbana 22 L', description: 'Tecido com tratamento repelente à água, bolso acolchoado para notebook de até 15\', compartimento secreto nas costas e alças com espuma de alta densidade.', price: '289.90', stock: 15 },
  { name: 'Relógio Minimal Aço', description: 'Mostrador limpo, caixa de 38 mm em aço escovado, vidro de safira resistente a riscos e pulseira de malha com fecho ajustável. Resistente a respingos.', price: '459.00', stock: 7 },
  { name: 'Teclado Mecânico TKL', description: 'Layout tenkeyless ABNT2, switches táteis marrons, teclas em PBT e iluminação branca com seis efeitos. Cabo USB-C removível.', price: '399.90', stock: 2 },
  { name: 'Vaso Autoirrigável', description: 'Vaso de 18 cm com reservatório que leva água às raízes por capilaridade. Indicador de nível e substrato inicial incluso.', price: '89.90', stock: 40 },
  { name: 'Garrafa Térmica 750 ml', description: 'Parede dupla de aço inox com vácuo, tampa à prova de vazamento e pintura que não descasca. Livre de BPA.', price: '119.90', stock: 0 },
  { name: 'Caixa de Som Portátil', description: 'Som 360° com graves reforçados, certificação IP67 contra água e poeira, 12 horas de bateria e pareamento de duas caixas.', price: '279.00', stock: 12 },
  { name: 'Câmera Instantânea Mini', description: 'Revela fotos em formato mini em cerca de 90 segundos. Flash e exposição automáticos, espelho para selfie e modo close-up.', price: '599.00', stock: 4 },
  { name: 'Caderno Pontilhado A5', description: 'Papel pontilhado de 120 g/m² que não vaza caneta, 160 páginas numeradas, índice, fita marcadora e elástico.', price: '54.90', stock: 80 },
  { name: 'Caneca Cerâmica Fosca 350 ml', description: 'Cerâmica de alta temperatura com acabamento fosco por fora e esmaltado por dentro. Pode ir ao micro-ondas e à lava-louças.', price: '49.90', stock: 5 },
];

export async function seed(dataSource: DataSource) {
  const users = dataSource.getRepository(UserEntity);
  const products = dataSource.getRepository(ProductEntity);

  const password = await bcrypt.hash(PASSWORD, 10);
  for (const user of USERS) {
    if (!(await users.existsBy({ email: user.email }))) {
      await users.save(users.create({ ...user, password }));
    }
  }

  for (const product of PRODUCTS) {
    if (!(await products.existsBy({ name: product.name }))) {
      await products.save(products.create(product));
    }
  }
}

// yarn seed            → só acrescenta o que falta
// yarn seed --reset    → APAGA o banco, recria o schema pelas entidades e semeia
if (require.main === module) {
  // import tardio: data-source lê o .env, o que não deve acontecer nos testes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { AppDataSource } = require('../data-source');
  const reset = process.argv.includes('--reset');
  new DataSource({ ...AppDataSource.options, logging: false })
    .initialize()
    .then(async (ds: DataSource) => {
      if (reset) await ds.synchronize(true);
      await seed(ds);
      await ds.destroy();
    })
    .then(() => console.log('Seed concluído.'))
    .catch((error: unknown) => {
      console.error('Seed falhou', error);
      process.exit(1);
    });
}
