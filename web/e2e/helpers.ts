import { expect, type Page } from '@playwright/test';

export const CLIENTE = 'cliente@prateleira.com';
export const ADMIN = 'admin@prateleira.com';

export async function login(page: Page, email: string, password = '123456') {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

export async function loginAsCliente(page: Page) {
  await login(page, CLIENTE);
  await expect(page).toHaveURL(/\/produtos$/);
}

/** Admin entra no dashboard; por padrão segue para a tela de produtos. */
export async function loginAsAdmin(
  page: Page,
  then: string | null = '/admin/produtos',
) {
  await login(page, ADMIN);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible();
  if (then) await page.goto(then);
}

export async function logout(page: Page) {
  await page.evaluate(() => localStorage.removeItem('prateleira.token'));
}

/** Abre o detalhe do produto pelo catálogo e o coloca num carrinho novo. */
export async function addToNewCart(
  page: Page,
  productName: string,
  quantity = 1,
) {
  await page.goto('/produtos');
  await page.getByRole('link', { name: productName, exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: productName }),
  ).toBeVisible();
  for (let i = 1; i < quantity; i++)
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click();
  await page.getByLabel('Adicionar ao').selectOption('novo');
  await page.getByRole('button', { name: /^Adicionar ao carrinho/ }).click();
  const toast = page.getByRole('status').filter({ hasText: productName });
  await expect(toast).toBeVisible();
  // "Fone Bluetooth Aura · Carrinho #3" → 3
  return Number((await toast.textContent())!.match(/Carrinho #(\d+)/)![1]);
}

export const cartPanel = (page: Page, cartId: number) =>
  page.getByRole('region', { name: `Carrinho ${cartId}` });
