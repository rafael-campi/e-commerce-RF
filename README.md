# E-commerce API (NestJS)

API backend de um e-commerce: cadastro e login de usuários (JWT), catálogo de produtos, carrinho de compras e pagamento. Desenvolvida com **NestJS**, **TypeScript**, **TypeORM** e **PostgreSQL**, com testes end-to-end.

## Funcionalidades

- **Autenticação**: login com e-mail e senha, devolvendo um JWT (válido por 1 dia). O cadastro é público (`POST /users`).
- **Papéis**: `ADMIN` (1), `MODERATOR` (2) e `USER` (3, padrão). Ninguém se cadastra como ADMIN.
- **Produtos**: qualquer usuário autenticado consulta; só `ADMIN` cria, altera e remove.
- **Carrinho**: cada usuário cria, lista e remove apenas os próprios carrinhos; itens têm quantidade.
- **Pagamento**: cobra a soma de preço × quantidade dos itens, via uma interface de gateway (`PaymentGateway`).

> O gateway padrão (`LocalPaymentGateway`) **não cobra de verdade**: apenas gera uma referência. Stripe, PagSeguro ou Pix entram implementando a interface `PaymentGateway`.

## Como rodar

Requisitos: Node 20+, Yarn e Docker.

```bash
yarn install
cp .env.example .env        # ajuste SECRET_KEY_JWT
docker compose up -d db     # Postgres de desenvolvimento (porta 5432)
yarn start:dev              # http://localhost:3000
```

Variáveis de ambiente (`.env`):

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` | Porta da API | `3000` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexão com o Postgres | ver `.env.example` |
| `SECRET_KEY_JWT` | Segredo usado para assinar o JWT | — (obrigatório) |

Os scripts de migration existem (`yarn migration:generate`, `yarn migration:run`), mas **ainda não há arquivos de migration versionados**; gere-os antes de usar um banco de produção. O seeder (`yarn seed`) cria um admin e um usuário comum.

## Endpoints

Rotas protegidas exigem o header `Authorization: Bearer <token>`.

### Autenticação

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/login` | público | Retorna `{ "access_token": "..." }`. Credenciais inválidas: `401`. |
| GET | `/auth/me` | autenticado | Dados do usuário logado (sem senha). |

### Usuários

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/users` | público | Cadastro. Body: `email`, `password` (mín. 6), `firstName?`, `lastName?`. Papel sempre `USER`. |
| GET | `/users` | ADMIN | Lista usuários. |
| GET | `/users/:id` | ADMIN, USER | Busca um usuário. USER só consulta a si mesmo (`403` para outro). |
| PATCH | `/users/:id` | ADMIN | Atualização parcial (inclusive `role`: 1, 2 ou 3). E-mail já usado: `400`. |
| DELETE | `/users/:id` | ADMIN | Remove. |

Respostas nunca incluem a senha.

### Produtos

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/products` | autenticado | Lista produtos. |
| GET | `/products/:id` | autenticado | Busca um produto (`404` se não existir). |
| POST | `/products` | ADMIN | Cria. Body: `name` (único: `409` se repetido), `description`, `price` (≥ 0, até 2 casas), `stock` (inteiro ≥ 0). |
| PATCH | `/products/:id` | ADMIN | Atualiza campos do produto. |
| DELETE | `/products/:id` | ADMIN | Remove. `409` se o produto está em algum carrinho. |

### Carrinho

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/cart` | Cria um carrinho. Body: `{ "items": [{ "productId": 1, "quantity": 2 }] }` (ao menos 1 item, `quantity` inteiro ≥ 1). Produto inexistente: `404`. Quantidade acima do estoque: `400`. |
| GET | `/cart` | Lista os carrinhos do usuário autenticado. |
| DELETE | `/cart/:id` | Remove um carrinho do próprio usuário (`404` caso contrário). |

### Pagamento

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/payment` | Paga um carrinho. Body: `{ "paymentMethod": "pix" \| "credit_card", "cartId": 1 }`. |

Resposta (`201`): `id`, `amount`, `payment_method`, `payment_status` (`progress`), `gatewayReference`, `cartId`, `userId`, `createdAt`.
O pagamento baixa o estoque dos itens. Erros: `400` método ou `cartId` inválido, `404` carrinho inexistente ou de outro usuário, `409` carrinho já pago ou estoque insuficiente, `502` falha do gateway (o estoque é devolvido).

## Testes

A suíte é toda **end-to-end**: sobe a aplicação real e chama a API HTTP (Jest + supertest) contra um Postgres de teste isolado (porta `5434`, em memória), recriado a cada suíte. Só o gateway de pagamento é substituído por um fake.

```bash
docker compose up -d dbtest
yarn test:e2e
```

O CI (GitHub Actions) roda o typecheck e os testes a cada push.

## Desenvolvimento orientado a testes

Cada mudança começa por um teste e2e que falha, depois a implementação mínima. Testes verificam apenas comportamento externo (status, corpo, estado observável), nunca detalhes internos. Veja `CLAUDE.md` e `docs/agents/` para o fluxo de issues.
