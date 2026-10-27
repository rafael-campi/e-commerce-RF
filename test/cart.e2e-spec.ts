import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './helpers/app';
import { createUser, loginAs, TestUser } from './helpers/users';
import { UserType } from '../src/enums/user-types.enum';

describe('Cart (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let produtoA: { id: number };
  let produtoB: { id: number };

  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  const newCustomer = async (): Promise<{ user: TestUser; token: string }> => {
    const user = await createUser(app);
    return { user, token: await loginAs(app, user.email, user.password) };
  };

  const createCart = (token: string, items: object[]) =>
    http().post('/cart').set(bearer(token)).send({ items });

  const listCarts = async (token: string) =>
    (await http().get('/cart').set(bearer(token)).expect(200)).body;

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createUser(app, { role: UserType.ADMIN });
    adminToken = await loginAs(app, admin.email, admin.password);

    const createProduct = async (name: string, price: number) =>
      (
        await http()
          .post('/products')
          .set(bearer(adminToken))
          .send({ name, description: 'desc', price, stock: 50 })
          .expect(201)
      ).body;
    produtoA = await createProduct('Produto A', 10);
    produtoB = await createProduct('Produto B', 25.5);
  });

  afterAll(async () => {
    await app.close();
  });

  it('exige autenticação', async () => {
    await http().get('/cart').expect(401);
    await http().post('/cart').send({ items: [] }).expect(401);
    await http().delete('/cart/1').expect(401);
  });

  describe('criação', () => {
    it('cria carrinho com itens e quantidades', async () => {
      const { token } = await newCustomer();

      const response = await createCart(token, [
        { productId: produtoA.id, quantity: 2 },
        { productId: produtoB.id, quantity: 1 },
      ]).expect(201);

      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.items).toHaveLength(2);
      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            quantity: 2,
            product: expect.objectContaining({ id: produtoA.id }),
          }),
          expect.objectContaining({
            quantity: 1,
            product: expect.objectContaining({ id: produtoB.id }),
          }),
        ]),
      );
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('rejeita produto inexistente sem deixar carrinho órfão', async () => {
      const { token } = await newCustomer();

      await createCart(token, [
        { productId: produtoA.id, quantity: 1 },
        { productId: 99999, quantity: 1 },
      ]).expect(404);

      expect(await listCarts(token)).toEqual([]);
    });

    it.each([
      ['quantidade zero', [{ productId: 1, quantity: 0 }]],
      ['quantidade negativa', [{ productId: 1, quantity: -3 }]],
      ['quantidade fracionada', [{ productId: 1, quantity: 1.5 }]],
      ['quantidade ausente', [{ productId: 1 }]],
      ['lista de itens vazia', []],
    ])('rejeita %s', async (_nome, items) => {
      const { token } = await newCustomer();

      await createCart(token, items).expect(400);
    });
  });

  describe('estoque', () => {
    const createLimited = async (stock: number) =>
      (
        await http()
          .post('/products')
          .set(bearer(adminToken))
          .send({
            name: `Limitado ${stock}-${Math.random()}`,
            description: 'desc',
            price: 5,
            stock,
          })
          .expect(201)
      ).body;

    it('aceita quantidade igual ao estoque', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(3);

      await createCart(token, [{ productId: product.id, quantity: 3 }]).expect(
        201,
      );
    });

    it('rejeita quantidade acima do estoque sem criar carrinho', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(3);

      await createCart(token, [{ productId: product.id, quantity: 4 }]).expect(
        400,
      );

      expect(await listCarts(token)).toHaveLength(0);
    });

    it('soma linhas repetidas do mesmo produto antes de comparar com o estoque', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(5);

      await createCart(token, [
        { productId: product.id, quantity: 3 },
        { productId: product.id, quantity: 3 },
      ]).expect(400);
    });
  });

  describe('listagem', () => {
    it('lista somente os carrinhos do usuário autenticado', async () => {
      const ana = await newCustomer();
      const bia = await newCustomer();
      const carrinhoAna = (
        await createCart(ana.token, [
          { productId: produtoA.id, quantity: 3 },
        ]).expect(201)
      ).body;
      await createCart(bia.token, [
        { productId: produtoB.id, quantity: 1 },
      ]).expect(201);

      const carrinhos = await listCarts(ana.token);

      expect(carrinhos).toHaveLength(1);
      expect(carrinhos[0].id).toBe(carrinhoAna.id);
      expect(carrinhos[0].cartItem[0]).toMatchObject({
        quantity: 3,
        product: { id: produtoA.id },
      });
    });

    it('ignora header "user" enviado pelo cliente', async () => {
      const ana = await newCustomer();
      const bia = await newCustomer();

      await http()
        .post('/cart')
        .set(bearer(bia.token))
        .set('user', String(ana.user.id))
        .send({ items: [{ productId: produtoA.id, quantity: 1 }] })
        .expect(201);

      expect(await listCarts(ana.token)).toEqual([]);
      expect(await listCarts(bia.token)).toHaveLength(1);
    });
  });

  describe('remoção', () => {
    it('remove o próprio carrinho', async () => {
      const { token } = await newCustomer();
      const cart = (
        await createCart(token, [
          { productId: produtoA.id, quantity: 1 },
        ]).expect(201)
      ).body;

      await http()
        .delete(`/cart/${cart.id}`)
        .set(bearer(token))
        .expect(200);

      expect(await listCarts(token)).toEqual([]);
    });

    it('não remove carrinho de outro usuário', async () => {
      const dono = await newCustomer();
      const intruso = await newCustomer();
      const cart = (
        await createCart(dono.token, [
          { productId: produtoA.id, quantity: 1 },
        ]).expect(201)
      ).body;

      await http()
        .delete(`/cart/${cart.id}`)
        .set(bearer(intruso.token))
        .expect(404);

      expect(await listCarts(dono.token)).toHaveLength(1);
    });

    it('retorna 404 para carrinho inexistente', async () => {
      const { token } = await newCustomer();

      await http().delete('/cart/99999').set(bearer(token)).expect(404);
    });
  });

  describe('itens', () => {
    const putItem = (token: string, cartId: number, productId: number, body: object) =>
      http()
        .put(`/cart/${cartId}/items/${productId}`)
        .set(bearer(token))
        .send(body);

    const deleteItem = (token: string, cartId: number, productId: number) =>
      http().delete(`/cart/${cartId}/items/${productId}`).set(bearer(token));

    const newCart = async (token: string, quantity = 1) =>
      (
        await createCart(token, [{ productId: produtoA.id, quantity }]).expect(
          201,
        )
      ).body;

    const pay = (token: string, cartId: number) =>
      http()
        .post('/payment')
        .set(bearer(token))
        .send({ paymentMethod: 'pix', cartId })
        .expect(201);

    const createLimited = async (stock: number) =>
      (
        await http()
          .post('/products')
          .set(bearer(adminToken))
          .send({
            name: `Item limitado ${stock}-${Math.random()}`,
            description: 'desc',
            price: 5,
            stock,
          })
          .expect(201)
      ).body;

    it('exige autenticação', async () => {
      await http().put('/cart/1/items/1').send({ quantity: 1 }).expect(401);
      await http().delete('/cart/1/items/1').expect(401);
    });

    it('altera a quantidade de um item existente', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await putItem(token, cart.id, produtoA.id, { quantity: 4 }).expect(200);

      const [listed] = await listCarts(token);
      expect(listed.cartItem).toHaveLength(1);
      expect(listed.cartItem[0]).toMatchObject({
        quantity: 4,
        product: { id: produtoA.id },
      });
    });

    it('adiciona um produto novo a um carrinho existente', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      const response = await putItem(token, cart.id, produtoB.id, {
        quantity: 2,
      }).expect(200);

      expect(response.body.id).toBe(cart.id);
      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            quantity: 1,
            product: expect.objectContaining({ id: produtoA.id }),
          }),
          expect.objectContaining({
            quantity: 2,
            product: expect.objectContaining({ id: produtoB.id }),
          }),
        ]),
      );
    });

    it('rejeita quantidade acima do estoque sem alterar o item', async () => {
      const { token } = await newCustomer();
      const product = await createLimited(3);
      const cart = (
        await createCart(token, [
          { productId: product.id, quantity: 2 },
        ]).expect(201)
      ).body;

      await putItem(token, cart.id, product.id, { quantity: 4 }).expect(400);

      const [listed] = await listCarts(token);
      expect(listed.cartItem[0].quantity).toBe(2);
    });

    it.each([
      ['zero', { quantity: 0 }],
      ['fracionada', { quantity: 1.5 }],
      ['ausente', {}],
    ])('rejeita quantidade %s', async (_nome, body) => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await putItem(token, cart.id, produtoA.id, body).expect(400);
    });

    it('retorna 404 para produto inexistente', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await putItem(token, cart.id, 99999, { quantity: 1 }).expect(404);
    });

    it('retorna 404 para carrinho de outro usuário', async () => {
      const dono = await newCustomer();
      const intruso = await newCustomer();
      const cart = await newCart(dono.token);

      await putItem(intruso.token, cart.id, produtoA.id, {
        quantity: 2,
      }).expect(404);
      await deleteItem(intruso.token, cart.id, produtoA.id).expect(404);
    });

    it('retorna 409 ao mexer em carrinho já pago', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);
      await pay(token, cart.id);

      await putItem(token, cart.id, produtoA.id, { quantity: 2 }).expect(409);
      await deleteItem(token, cart.id, produtoA.id).expect(409);
      await http().delete(`/cart/${cart.id}`).set(bearer(token)).expect(409);
    });

    it('remove um item e mantém o carrinho com os demais', async () => {
      const { token } = await newCustomer();
      const cart = (
        await createCart(token, [
          { productId: produtoA.id, quantity: 1 },
          { productId: produtoB.id, quantity: 1 },
        ]).expect(201)
      ).body;

      await deleteItem(token, cart.id, produtoA.id).expect(200);

      const [listed] = await listCarts(token);
      expect(listed.cartItem).toHaveLength(1);
      expect(listed.cartItem[0].product.id).toBe(produtoB.id);
    });

    it('remove o carrinho quando o último item sai', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await deleteItem(token, cart.id, produtoA.id).expect(200);

      expect(await listCarts(token)).toEqual([]);
    });

    it('retorna 404 ao remover item que não está no carrinho', async () => {
      const { token } = await newCustomer();
      const cart = await newCart(token);

      await deleteItem(token, cart.id, produtoB.id).expect(404);
    });

    it('carrinho pago some da listagem', async () => {
      const { token } = await newCustomer();
      const pago = await newCart(token);
      const aberto = await newCart(token);
      await pay(token, pago.id);

      const carrinhos = await listCarts(token);

      expect(carrinhos.map((c) => c.id)).toEqual([aberto.id]);
    });
  });
});
