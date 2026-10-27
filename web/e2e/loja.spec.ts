import { expect, test } from '@playwright/test';
import { addToNewCart, cartPanel, login, loginAsCliente } from './helpers';

test('login com senha errada mostra "E-mail ou senha incorretos"', async ({
  page,
}) => {
  await login(page, 'cliente@prateleira.com', 'senha-errada');
  await expect(
    page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/entrar$/);

  await login(page, 'ninguem@prateleira.com', '123456');
  await expect(
    page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos' }),
  ).toBeVisible();
});

test('rota protegida sem login leva ao login e volta depois', async ({
  page,
}) => {
  await page.goto('/carrinhos');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByText('Entre na sua conta para continuar.'),
  ).toBeVisible();
  await page.getByLabel('E-mail').fill('cliente@prateleira.com');
  await page.getByLabel('Senha', { exact: true }).fill('123456');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/\/carrinhos$/);
});

test('o seletor de quantidade para no estoque disponível', async ({ page }) => {
  await loginAsCliente(page);
  // Teclado Mecânico TKL: 2 em estoque no seed
  await page.goto('/produtos');
  await page.getByRole('link', { name: 'Teclado Mecânico TKL' }).click();
  const plus = page.getByRole('button', { name: 'Aumentar quantidade' });
  await plus.click();
  await expect(page.getByLabel('Quantidade', { exact: true })).toHaveValue('2');
  await expect(plus).toBeDisabled();
  await expect(
    page.getByText('Você selecionou todo o estoque disponível.'),
  ).toBeVisible();
});

test('no carrinho, digitar quantidade acima do estoque mostra o erro 400', async ({
  page,
}) => {
  await loginAsCliente(page);
  const cartId = await addToNewCart(page, 'Teclado Mecânico TKL');

  await page.goto('/carrinhos');
  const panel = cartPanel(page, cartId);
  const qty = panel.getByLabel(
    `Quantidade de Teclado Mecânico TKL no carrinho #${cartId}`,
  );
  await qty.fill('5');
  await qty.press('Enter');

  await expect(
    panel.getByText('Quantidade acima do estoque (400)'),
  ).toBeVisible();
  await expect(
    panel.getByText(/Você pediu 5 unidades, mas só há 2/),
  ).toBeVisible();
  await expect(qty).toHaveValue('1');
  await expect(
    panel.getByRole('button', { name: 'Ir para pagamento' }),
  ).toBeDisabled();

  // não deixa lixo para os outros cenários
  await panel.getByRole('button', { name: 'Remover carrinho' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Remover carrinho' })
    .click();
  await expect(panel).toHaveCount(0);
});
