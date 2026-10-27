# E-commerce API (NestJS)

API backend de um e-commerce: cadastro e login de usuários (JWT), catálogo de produtos, carrinho de compras e pagamento. Desenvolvida com **NestJS**, **TypeScript**, **TypeORM** e **PostgreSQL**, com testes end-to-end.

## Funcionalidades

- **Autenticação**: login com e-mail e senha, devolvendo um JWT (válido por 1 dia). O cadastro é público (`POST /users`).
- **Papéis**: `ADMIN` (1), `MODERATOR` (2) e `USER` (3, padrão). Ninguém se cadastra como ADMIN.
- **Produtos**: qualquer usuário autenticado consulta; só `ADMIN` cria, altera e remove.
- **Carrinho**: cada usuário cria, lista e remove apenas os próprios carrinhos; itens têm quantidade.
- **Pagamento**: cobra a soma de preço × quantidade dos itens por uma **Tentativa de pagamento** (ver [`CONTEXT.md`](CONTEXT.md) e [`docs/adr/0001`](docs/adr/0001-pagamentos-via-psp-proprio.md)). Pix e cartão passam pelo PSP próprio ([`payment-ledger-service`](../payment-ledger-service)):
  - **Pix:** a loja mostra o QR Code, e o Pedido nasce quando o PSP avisa, por webhook, que o dinheiro chegou.
  - **Cartão:** o navegador envia o cartão **direto ao PSP** (`POST /v1/tokens`, com a chave publicável) e a loja recebe só um token. A aprovação ou recusa volta na hora, com o motivo da recusa.

> Sem `PSP_URL`, o gateway local (`LocalPaymentGateway`) **aprova tudo na hora, não cobra nada e não pede os dados do cartão**: é o modo do CI e do Playwright.

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
| `PSP_URL`, `PSP_SECRET_KEY`, `PSP_PUBLISHABLE_KEY`, `PSP_WEBHOOK_SECRET` | Conexão com o PSP; preenchidas por `yarn psp:setup` | sem PSP (gateway local) |
| `PSP_PUBLIC_URL` | Como o navegador alcança o PSP para tokenizar cartões | `/psp` (proxy do Vite) |
| `PAYMENTS_RECONCILE_INTERVAL_MS` | De quanto em quanto tempo conferir no PSP os Pix pendentes vencidos (`0` desliga) | `60000` |

#### Imagem de produção e docker-compose

[`.docker/app/Dockerfile`](.docker/app/Dockerfile) gera a imagem de produção da API. O `Dockerfile` da raiz continua sendo o de desenvolvimento. Ao subir, a imagem cria o schema e semeia. O front tem a própria imagem ([`web/Dockerfile`](web/Dockerfile), nginx). A loja inteira, com PSP e gateway, sobe pelo `docker-compose.yml` do repositório `api-gateway`.

#### Ligando ao PSP

Com o `payment-ledger-service` rodando (porta 3001), cadastre a loja como lojista e registre o webhook. O script grava as três variáveis `PSP_*` no `.env`:

```bash
PLATFORM_ADMIN_TOKEN=<o mesmo do .env do PSP> yarn psp:setup
yarn start:dev
```

Em dev, a tela do Pix tem um botão **Simular pagamento (teste)**, que paga o QR Code no simulador do PSP (via proxy `/psp` do Vite). No cartão, `4242 4242 4242 4242` aprova e `4000 0000 0000 9995` é recusado por saldo; os demais cartões de teste estão no `routes.http` do PSP.

Ao atualizar um banco de dev existente, rode `yarn schema:sync` para criar as tabelas `payment_attempts` e `processed_webhook_events` e as colunas novas da Tentativa.

Os scripts de migration existem (`yarn migration:generate`, `yarn migration:run`), mas **ainda não há arquivos de migration versionados**; gere-os antes de usar um banco de produção. O seed (`yarn seed`; `yarn seed --reset` apaga o banco e recria o schema antes; `yarn seed --demo` acrescenta clientes e ~120 Pedidos de exemplo dos últimos 30 dias, com referência `DEMO-…` e sem mexer no estoque, para o dashboard ter dados) cria os dados da Loja Prateleira: `admin@prateleira.com` (ADMIN) e `cliente@prateleira.com` (USER), ambos com senha `123456`, e os 12 produtos do catálogo. Pode rodar mais de uma vez sem duplicar nada.

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
| GET | `/cart` | Lista os carrinhos **abertos** (não pagos) do usuário autenticado, com os produtos de cada item. |
| PUT | `/cart/:id/items/:productId` | Define a quantidade de um produto no carrinho (insere se não estiver). Body: `{ "quantity": 2 }`. Acima do estoque: `400`. Produto ou carrinho inexistente: `404`. Carrinho já pago: `409`. |
| DELETE | `/cart/:id/items/:productId` | Remove o item; o carrinho é removido junto quando fica vazio. `404` se o item não está no carrinho, `409` se já foi pago. |
| DELETE | `/cart/:id` | Remove um carrinho do próprio usuário (`404` caso contrário, `409` se já foi pago). |

### Pagamento

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/payment` | Paga um carrinho: abre (ou retoma) a Tentativa de pagamento. Body: `{ "paymentMethod": "pix" \| "credit_card", "cartId": 1 }`; com PSP, o cartão também leva `cardToken` (do PSP) e `installments` (1 a 12). |
| GET | `/payment/config` | Para o checkout: `{ card: { publishableKey, pspUrl } }` com PSP, ou `{ card: null }` (sem dados de cartão). |
| GET | `/payment/attempts/:id` | Acompanha a Tentativa (o front consulta a cada 2 s enquanto o Pix está pendente). |
| POST | `/payment/attempts/:id/cancel` | Cancela uma Tentativa pendente e devolve o estoque. Se o cliente já tinha pago, vale o pagamento. |
| POST | `/webhooks/payments` | Eventos do PSP. Público; autenticado pela assinatura `PSP-Signature` (HMAC sobre o corpo cru). |

Resposta da Tentativa: `id`, `cartId`, `status` (`pending`, `succeeded`, `failed`, `expired`, `canceled`), `method`, `amount`, `expiresAt`, `pix` (`{ copiaECola }` enquanto pendente), `card` (`{ brand, last4 }`), `failure` (`{ code, message }` quando recusado) e `order` (o Pedido, com `id`, `amount`, `payment_method`, `payment_status`, `gatewayReference`, `cartId`, `userId` e `createdAt`, quando deu certo).

- Abrir a Tentativa **reserva o estoque** e trava o carrinho (`409` ao editar). Pedir de novo com o mesmo método retoma a mesma Tentativa, sem cobrar duas vezes.
- Aprovada na hora (cartão), a Tentativa já volta `succeeded` com o Pedido. O Pix volta `pending` com o copia e cola e vira Pedido quando chega o webhook `payment.succeeded`.
- `expired`, `canceled` ou `failed` devolvem o estoque e liberam o carrinho. Webhooks repetidos são ignorados pelo id do evento.
- Erros: `400` método ou `cartId` inválido, `404` carrinho inexistente ou de outro usuário, `409` carrinho já pago, estoque insuficiente ou outro método em andamento, `402` pagamento recusado (a mensagem explica o motivo, ex.: saldo insuficiente), `502` falha do gateway (o estoque é devolvido).

### Pedidos

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/orders/:id/refund` | ADMIN | Estorna o Pedido inteiro pelo gateway; os itens voltam ao estoque. Idempotente. Responde o Pedido com `status` `refunded` (ou `refund_pending` enquanto o gateway não confirma; o webhook `refund.*` conclui). `409`/`422` quando o gateway recusa, com o motivo. |
| GET | `/orders` | ADMIN | Lista os Pedidos (carrinhos pagos), do mais recente ao mais antigo: `id`, `amount`, `paymentMethod`, `status` (`paid`, `refund_pending` ou `refunded`), `gatewayReference`, `createdAt`, `refundedAt`, `cartId`, `customer` e `items` (`productId`, `name`, `price` atual, `quantity`). |

## Front-end (`web/`)

Loja Prateleira em **React + Vite + TypeScript**, feita a partir do protótipo navegável. Consome esta API pelo proxy do Vite (`/api` → `localhost:3000`), sem CORS.

```bash
docker compose up -d db
yarn seed                      # usuários e catálogo da Prateleira (senha 123456)
yarn start:dev                 # API em :3000
cd web && yarn install && yarn dev   # front em http://localhost:5173
```

Contas: `cliente@prateleira.com` (cliente) e `admin@prateleira.com` (administrador), ambas com senha `123456`. Para apontar para outra API: `API_URL=http://localhost:3100 yarn dev`.

| Rota | Tela |
| --- | --- |
| `/entrar`, `/cadastro` | Login e cadastro |
| `/produtos`, `/produtos/:id` | Catálogo (busca `?busca=`) e detalhe |
| `/carrinhos` | Carrinhos abertos do cliente |
| `/carrinhos/:id/pagamento`, `/pedidos/:id` | Pagamento e confirmação do Pedido |
| `/perfil` | Dados da conta |
| `/admin` | Dashboard: KPIs, gráficos e tabelas do período (hoje, 7 ou 30 dias, ou personalizado até 60), com exportação em CSV |
| `/admin/produtos`, `/admin/usuarios`, `/admin/pedidos` | Área do administrador |
| `/design-system` | Componentes e cores nos dois temas (**só em `yarn dev`**, fora do build) |

O layout é responsivo (desktop e celular) e o tema segue o sistema, com um botão para alternar entre sistema, claro e escuro.

### Financeiro (`/admin/financeiro`)

O dinheiro da loja no PSP, só para ADMIN. A tela mostra:
- quanto já pode ser sacado;
- quanto ainda vai entrar, com a agenda de recebíveis por mês e por parcela;
- o histórico de repasses.

Nela o admin cadastra a chave Pix de repasse e solicita um repasse. A API da loja chama o PSP com a chave secreta, do lado do servidor (`GET /admin/finance`, `POST /admin/finance/payouts` com `Idempotency-Key`, `PUT /admin/finance/payout-key`). Sem PSP, a tela explica como configurá-lo.

### Métricas (dashboard)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/admin/metrics?from=AAAA-MM-DD&to=AAAA-MM-DD` | ADMIN | Resumo do período (dias de São Paulo, até 60): `revenue`, `paidOrders`, `averageTicket`, `newUsers`, `openCarts` (estado atual), `previous` (mesmos números no período anterior de igual tamanho), `byMethod`, `series` (por dia, ou em faixas de 2 h quando `from = to`) e `topProducts` (5 mais vendidos por receita). Valores em reais, como número. Datas inválidas, início depois do fim ou período maior que 60 dias: `400`. |

## Testes

A suíte é toda **end-to-end**: sobe a aplicação real e chama a API HTTP (Jest + supertest) contra um Postgres de teste isolado (porta `5434`, em memória), recriado a cada suíte. Só o gateway de pagamento é substituído por um fake.

```bash
docker compose up -d dbtest
yarn test:e2e
```

O front tem testes **Playwright** (`web/e2e/`) que sobem a API (porta 3100) e o Vite (porta 5180) e usam o navegador de verdade: compra completa até o pedido aparecer no dashboard e no admin, filtro de período do dashboard, admin criando produto, login inválido, seletor de quantidade limitado ao estoque, erro 400 no carrinho e os dois 409 do admin. Antes da suíte, o banco de teste é recriado com `yarn seed --reset`.

```bash
docker compose up -d dbtest
cd web && npx playwright install chromium   # só na primeira vez
yarn test:e2e
```

As duas suítes usam o mesmo banco de teste: rode uma de cada vez.

O CI (GitHub Actions) roda o typecheck e os testes da API e, num job separado, o build e os testes Playwright do front a cada push.

## Desenvolvimento orientado a testes

Cada mudança começa por um teste e2e que falha, depois a implementação mínima. Testes verificam apenas comportamento externo (status, corpo, estado observável), nunca detalhes internos. Veja `CLAUDE.md` e `docs/agents/` para o fluxo de issues.
