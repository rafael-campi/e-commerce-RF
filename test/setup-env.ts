import * as dotenv from 'dotenv';
import { join } from 'path';

// Roda antes de qualquer import da aplicação: aponta tudo para o banco de teste.
dotenv.config({ path: join(__dirname, '..', '.env.test') });

// Mesmo fuso de quem usa a loja: datas sem fuso no banco não podem depender dele.
process.env.TZ = 'America/Sao_Paulo';
