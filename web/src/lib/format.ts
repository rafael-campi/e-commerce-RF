import type { IconName } from '../ui/Icon';
import {
  ROLE,
  type Cart,
  type Product,
  type RoleId,
  type RoleName,
  type User,
} from './types';

export const brl = (value: number | string) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const date = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

export const fullName = (u: Pick<User, 'firstName' | 'lastName' | 'email'>) =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

export const initials = (u: Pick<User, 'firstName' | 'lastName' | 'email'>) =>
  ((u.firstName?.[0] ?? u.email[0]) + (u.lastName?.[0] ?? '')).toUpperCase();

export const roleName = (role: RoleId): RoleName =>
  (Object.keys(ROLE) as RoleName[]).find((k) => ROLE[k] === role) ?? 'USER';

export const stockInfo = (p: Product) =>
  p.stock === 0
    ? { label: 'Esgotado', cls: 'danger' }
    : p.stock <= 5
      ? { label: 'Últimas unidades', cls: 'warning' }
      : { label: 'Em estoque', cls: 'success' };

// A API não guarda imagem: cada produto ganha ícone e cor fixos a partir do id.
// Com o seed, os ids 1–12 caem exatamente nos desenhos do protótipo.
const ART: [IconName, string][] = [
  ['headphones', '#6D4AFF'],
  ['press', '#B45309'],
  ['lamp', '#F59E0B'],
  ['backpack', '#0EA5E9'],
  ['watch', '#64748B'],
  ['keyboard', '#8B5CF6'],
  ['sprout', '#16A34A'],
  ['bottle', '#14B8A6'],
  ['speaker', '#EF4444'],
  ['camera', '#DB2777'],
  ['notebook', '#A16207'],
  ['mug', '#0F766E'],
];
export const artFor = (productId: number) => {
  const [icon, tone] = ART[(Math.max(1, productId) - 1) % ART.length];
  return { icon, tone };
};

/** Primeira frase da descrição, para o resumo da página de detalhe. */
export const lead = (text: string) =>
  text.match(/^.+?[.!?](\s|$)/)?.[0].trim() ?? text;

export const cartTotal = (cart: Cart) =>
  cart.cartItem.reduce(
    (sum, i) => sum + Number(i.product.price) * i.quantity,
    0,
  );

export const methodLabel = (m: string) =>
  m === 'pix' ? 'Pix' : 'Cartão de crédito';

/** "129,90", "R$ 1.299,90" ou "129.9" → número; null se inválido. */
export function parsePrice(input: string): number | null {
  let s = input.trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);
