import { expect, test } from '@playwright/test';
import { addToNewCart, loginAsAdmin, loginAsCliente, logout } from './helpers';

test('admin cria um produto e ele aparece na vitrine', async ({ page }) => {
  const name = `Luminária Teste ${Date.now()}`;
  await loginAsAdmin(page);

  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Novo produto' });
  await modal.getByLabel('Nome *').fill(name);
  await modal
    .getByLabel('Descrição')
    .fill('Criada pelo teste de ponta a ponta.');
  await modal.getByLabel('Preço (R$) *').fill('129,90');
  await modal.getByLabel('Estoque *').fill('7');
  await modal.getByRole('button', { name: 'Criar produto' }).click();

  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: 'Produto criado' }),
  ).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('R$ 129,90');
  await expect(row).toContainText('7');

  await logout(page);
  await loginAsCliente(page);
  await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
});

test('nome de produto repetido mostra o erro 409', async ({ page }) => {
  await loginAsAdmin(page);

  await page.getByRole('button', { name: 'Novo produto' }).first().click();
  const modal = page.getByRole('dialog', { name: 'Novo produto' });
  await modal.getByLabel('Nome *').fill('Fone Bluetooth Aura');
  await modal.getByLabel('Preço (R$) *').fill('379,90');
  await modal.getByLabel('Estoque *').fill('10');
  await modal.getByRole('button', { name: 'Criar produto' }).click();

  await expect(modal.getByText('Nome já cadastrado (409)')).toBeVisible();
  await expect(
    modal.getByText('Já existe um produto com este nome. Escolha outro.'),
  ).toBeVisible();
});

test('remover produto que está em algum carrinho mostra o erro 409', async ({
  page,
}) => {
  await loginAsCliente(page);
  await addToNewCart(page, 'Mochila Urbana 22 L');

  await logout(page);
  await loginAsAdmin(page);
  await page
    .getByRole('button', { name: 'Remover Mochila Urbana 22 L' })
    .click();
  await page.getByRole('button', { name: 'Remover produto' }).click();

  const modal = page.getByRole('dialog', {
    name: 'Não é possível remover este produto',
  });
  await expect(modal.getByText('Produto em carrinhos (409)')).toBeVisible();
  await modal.getByRole('button', { name: 'Fechar' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Mochila Urbana 22 L' }),
  ).toBeVisible();
});

test('cliente não acessa a área de admin', async ({ page }) => {
  await loginAsCliente(page);
  await page.goto('/admin/produtos');
  await expect(
    page.getByRole('heading', {
      name: 'Você não tem permissão para acessar esta página',
    }),
  ).toBeVisible();
});

test('dashboard filtra por período e valida o personalizado', async ({
  page,
}) => {
  await loginAsAdmin(page, null);
  const periodo = page.getByRole('group', { name: 'Período' });

  await periodo.getByRole('button', { name: '30 dias' }).click();
  await expect(page.getByText('Pedidos pagos, por dia')).toBeVisible();

  await periodo.getByRole('button', { name: 'Personalizado' }).click();
  await page.getByLabel('De').fill('2026-01-01');
  await page.getByLabel('Até').fill('2026-06-30');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(
    page.getByText('O período pode ter no máximo 60 dias.'),
  ).toBeVisible();
});
