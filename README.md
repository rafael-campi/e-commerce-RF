# E-commerce API - NestJS

Este projeto é uma API backend para um sistema de **E-commerce** desenvolvido utilizando **NestJS**, com funcionalidades de **autenticação de usuários** e **integração com métodos de pagamento**.

## Funcionalidades

- **Autenticação de usuários**:
  - Registro de usuários.
  - Login de usuários (JWT - JSON Web Tokens).
  - Proteção de rotas com autenticação.
  
- **Gestão de produtos**:
  - CRUD (Create, Read, Update, Delete) de produtos.
  
- **Carrinho de compras**:
  - Adicionar, remover e visualizar itens no carrinho.
  
- **Integração com gateways de pagamento**:
  - Pagamento via cartão de crédito.
  - Pagamento via Pix (exemplo de pagamento instantâneo no Brasil).
  - Integração com um gateway de pagamento como **Stripe** ou **PagSeguro**.

## Tecnologias

- **NestJS** - Framework principal para desenvolvimento backend.
- **TypeScript** - Linguagem utilizada no projeto.
- **TypeORM** - ORM para interação com o banco de dados (MySQL/PostgreSQL).
- **Passport** - Middleware para autenticação.
- **JWT (JSON Web Tokens)** - Para autenticação e gerenciamento de sessões.
- **Stripe** ou **PagSeguro** - Integração com métodos de pagamento.
- **bcryptjs** - Para criptografia de senhas.
- **class-validator** - Para validação de dados de entrada.


## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/ecommerce-api-nestjs.git
cd ecommerce-api-nestjs
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configuração do banco de dados

- Crie um banco de dados no seu SGBD (MySQL ou PostgreSQL).
- No arquivo `src/config/database.config.ts`, configure as credenciais do banco de dados.

### 4. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto e adicione as variáveis necessárias:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=usuario
DATABASE_PASSWORD=senha
DATABASE_NAME=ecommerce_db
JWT_SECRET=seu-segredo-jwt
STRIPE_SECRET_KEY=sua-chave-secreta-do-stripe
```

### 5. Rodando o projeto

Após a configuração, execute o projeto com o seguinte comando:

```bash
npm run start
```

A API estará disponível em `http://localhost:3000`.

## Endpoints da API

### 1. Autenticação

- **POST /auth/signup** - Registrar um novo usuário.
  
  **Request Body**:
  ```json
  {
    "email": "usuario@exemplo.com",
    "password": "senha123"
  }
  ```

- **POST /auth/login** - Login de um usuário.

  **Request Body**:
  ```json
  {
    "email": "usuario@exemplo.com",
    "password": "senha123"
  }
  ```

  **Response**:
  ```json
  {
    "access_token": "jwt_token_aqui"
  }
  ```

### 2. Produtos

- **POST /products** - Adicionar um novo produto.
  
  **Request Body**:
  ```json
  {
    "name": "Tênis Nike",
    "description": "Tênis esportivo de alta performance",
    "price": 300.00,
    "stock": 100
  }
  ```

- **GET /products** - Listar todos os produtos.

- **GET /products/:id** - Buscar um produto pelo ID.

- **PUT /products/:id** - Atualizar um produto.

- **DELETE /products/:id** - Remover um produto.

### 3. Carrinho

- **POST /cart** - Adicionar um item ao carrinho.

  **Request Body**:
  ```json
  {
    "productId": 1,
    "quantity": 2
  }
  ```

- **GET /cart** - Listar itens no carrinho.

- **DELETE /cart/:id** - Remover item do carrinho.

### 4. Pagamentos

- **POST /payments** - Realizar um pagamento.

  **Request Body**:
  ```json
  {
    "paymentMethod": "stripe",  // ou "pix"
    "amount": 600.00,
    "currency": "BRL",
    "token": "token_do_pagamento_do_stripe"
  }
  ```

## Testes

Execute os testes unitários e de integração com o seguinte comando:

```bash
npm run test
```

Para rodar testes de integração com banco de dados, é necessário configurar um banco de dados de teste.


## Licença

Este projeto é licenciado sob a **MIT License** - veja o arquivo [LICENSE](LICENSE) para mais detalhes.
