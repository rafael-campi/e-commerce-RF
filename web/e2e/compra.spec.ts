import { expect, test } from '@playwright/test';
import { addToNewCart, cartPanel, loginAsAdmin, loginAsCliente, logout } from './helpers';

test('compra completa: produto → carrinho → pagamento → pedido no admin', async ({ page }) => {
  await loginAsCliente(page);

  // Caneca Cerâmica Fosca 350 ml: R$ 49,90, 5 em estoque no seed
  await page.goto('/produtos');
  await page.getByRole('link', { name: 'Caneca Cerâmica Fosca 350 ml' }).click();
  await expect(page.getByText('5 unidades disponíveis')).toBeVisible();
  const cartId = await addToNewCart(page, 'Caneca Cerâmica Fosca 350 ml', 2);

  await page.getByRole('link', { name: /Carrinhos, \d+ itens/ }).click();
  const panel = cartPanel(page, cartId);
  await expect(panel.getByText('R$ 99,80').first()).toBeVisible();
  await panel.getByRole('button', { name: 'Ir para pagamento' }).click();

  await expect(page.getByRole('heading', { name: 'Pagamento', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /Cartão de crédito/ }).click();
  await page.getByRole('button', { name: 'Pagar R$ 99,80' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamento aprovado' })).toBeVisible();

  await page.getByRole('button', { name: 'Ver pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Pedido confirmado!' })).toBeVisible();
  const orderId = (await page.url()).match(/pedidos\/(\d+)/)![1];

  // o carrinho pago some e o estoque cai de 5 para 3
  await page.goto('/carrinhos');
  await expect(page.getByRole('heading', { level: 1, name: 'Meus carrinhos' })).toBeVisible();
  await expect(cartPanel(page, cartId)).toHaveCount(0);
  await page.goto('/produtos');
  await page.getByRole('link', { name: 'Caneca Cerâmica Fosca 350 ml' }).click();
  await expect(page.getByText('3 unidades disponíveis')).toBeVisible();

  // o pedido aparece para o administrador
  await logout(page);
  await loginAsAdmin(page);
  await page.getByRole('link', { name: /Pedidos/ }).click();
  const row = page.getByRole('row').filter({ hasText: `#${orderId}` });
  await expect(row).toContainText('Marcos Teixeira');
  await expect(row).toContainText('R$ 99,80');
  await expect(row).toContainText('Cartão');
  await expect(row).toContainText('Pago');
});
