import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const validProduct = (name: string) => ({
    name,
    description: 'Tênis esportivo de alta performance',
    price: 300,
    stock: 100,
  });
  const createProduct = async (name: string) =>
    (
      await http()
        .post('/products')
        .set(bearer(adminToken))
        .send(validProduct(name))
        .expect(201)
    ).body;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminToken = await loginAs(app, admin.email, admin.password);
    const user = await createUser(app, { role: UserType.USER });
    userToken = await loginAs(app, user.email, user.password);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('leitura (qualquer usuário autenticado)', () => {
    it('lista produtos', async () => {
      await createProduct('Tênis Lista');

      const response = await http()
        .get('/products')
        .set(bearer(userToken))
        .expect(200);

      expect(response.body.map((p) => p.name)).toContain('Tênis Lista');
    });

    it('consulta produto por id', async () => {
      const created = await createProduct('Tênis Consulta');

      const response = await http()
        .get(`/products/${created.id}`)
        .set(bearer(userToken))
        .expect(200);

      expect(response.body).toMatchObject({
        id: created.id,
        name: 'Tênis Consulta',
        price: '300.00',
        stock: 100,
      });
    });

    it('retorna 404 para produto inexistente', async () => {
      await http().get('/products/99999').set(bearer(userToken)).expect(404);
    });
  });

  describe('escrita (somente ADMIN)', () => {
    it('ADMIN cria produto', async () => {
      const response = await http()
        .post('/products')
        .set(bearer(adminToken))
        .send(validProduct('Tênis Novo'))
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Tênis Novo',
        price: '300.00',
        stock: 100,
      });
    });

    it('ADMIN atualiza produto', async () => {
      const created = await createProduct('Tênis Update');

      const response = await http()
        .patch(`/products/${created.id}`)
        .set(bearer(adminToken))
        .send({ price: 250.5, stock: 7 })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Tênis Update',
        price: '250.50',
        stock: 7,
      });
    });

    it('ADMIN remove produto', async () => {
      const created = await createProduct('Tênis Remove');

      await http()
        .delete(`/products/${created.id}`)
        .set(bearer(adminToken))
        .expect(200);

      await http()
        .get(`/products/${created.id}`)
        .set(bearer(adminToken))
        .expect(404);
    });

    it('usuário comum recebe 403 ao criar, alterar e remover', async () => {
      const created = await createProduct('Tênis Protegido');

      await http()
        .post('/products')
        .set(bearer(userToken))
        .send(validProduct('Tênis Invasor'))
        .expect(403);
      await http()
        .patch(`/products/${created.id}`)
        .set(bearer(userToken))
        .send({ price: 1 })
        .expect(403);
      await http()
        .delete(`/products/${created.id}`)
        .set(bearer(userToken))
        .expect(403);
    });
  });

  describe('remoção de produto em uso', () => {
    it('retorna 409 se o produto está em um carrinho e mantém o produto', async () => {
      const product = await createProduct('Em Carrinho');
      await http()
        .post('/cart')
        .set(bearer(userToken))
        .send({ items: [{ productId: product.id, quantity: 1 }] })
        .expect(201);

      await http()
        .delete(`/products/${product.id}`)
        .set(bearer(adminToken))
        .expect(409);

      await http()
        .get(`/products/${product.id}`)
        .set(bearer(userToken))
        .expect(200);
    });
  });

  describe('nome duplicado', () => {
    it('rejeita criar produto com nome já existente', async () => {
      await createProduct('Duplicado Criação');

      await http()
        .post('/products')
        .set(bearer(adminToken))
        .send(validProduct('Duplicado Criação'))
        .expect(409);
    });

    it('rejeita renomear para um nome já existente', async () => {
      await createProduct('Nome Ocupado');
      const other = await createProduct('Nome Livre');

      await http()
        .patch(`/products/${other.id}`)
        .set(bearer(adminToken))
        .send({ name: 'Nome Ocupado' })
        .expect(409);
    });

    it('permite atualizar mantendo o próprio nome', async () => {
      const product = await createProduct('Mesmo Nome');

      await http()
        .patch(`/products/${product.id}`)
        .set(bearer(adminToken))
        .send({ name: 'Mesmo Nome', stock: 7 })
        .expect(200);
    });
  });

  describe('id inválido', () => {
    it('rejeita id não numérico com 400', async () => {
      await http().get('/products/abc').set(bearer(adminToken)).expect(400);
      await http()
        .patch('/products/abc')
        .set(bearer(adminToken))
        .send({ stock: 1 })
        .expect(400);
      await http().delete('/products/abc').set(bearer(adminToken)).expect(400);
    });
  });

  describe('validação', () => {
    const rejects = (body: object) =>
      http().post('/products').set(bearer(adminToken)).send(body).expect(400);

    it('rejeita preço negativo', () =>
      rejects({ ...validProduct('Preço Negativo'), price: -1 }));

    it('rejeita nome vazio', () => rejects({ ...validProduct(''), name: '' }));

    it('rejeita estoque negativo', () =>
      rejects({ ...validProduct('Estoque Negativo'), stock: -5 }));

    it('rejeita estoque fracionado', () =>
      rejects({ ...validProduct('Estoque Fracionado'), stock: 1.5 }));
  });
});
