import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import type { Cart, Product } from '../lib/types';
import { useToast } from '../ui/toast';

export const useProducts = () =>
  useQuery({ queryKey: ['products'], queryFn: api.products });

export const useCarts = (enabled = true) =>
  useQuery({ queryKey: ['carts'], queryFn: api.carts, enabled });

export const itemCount = (carts: Cart[] | undefined) =>
  (carts ?? []).reduce(
    (sum, c) => sum + c.cartItem.reduce((s, i) => s + i.quantity, 0),
    0,
  );

/** Depois de mexer em carrinho ou pagar, carrinhos e estoque mudam juntos. */
export function useRefreshShop() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['carts'] }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['product'] }),
    ]);
}

/**
 * Soma `quantity` unidades de um Produto a um Carrinho aberto (ou cria um novo).
 * Quem decide se cabe no estoque é a API (400); aqui só mostramos o resultado.
 */
export function useAddToCart() {
  const queryClient = useQueryClient();
  const refresh = useRefreshShop();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      product,
      quantity,
      cartId,
    }: {
      product: Product;
      quantity: number;
      cartId: number | 'novo';
    }) => {
      if (cartId === 'novo') return api.createCart(product.id, quantity);
      const carts = await queryClient.fetchQuery({
        queryKey: ['carts'],
        queryFn: api.carts,
      });
      const cart = carts.find((c) => c.id === cartId);
      const current =
        cart?.cartItem.find((i) => i.product.id === product.id)?.quantity ?? 0;
      return api.setCartItem(cartId, product.id, current + quantity);
    },
    onSuccess: async (cart, { product, quantity }) => {
      await refresh();
      toast(
        'success',
        quantity === 1
          ? 'Adicionado ao carrinho'
          : `${quantity} itens adicionados`,
        `${product.name} · Carrinho #${cart.id}`,
        { label: 'Ver carrinho', to: '/carrinhos' },
      );
    },
    onError: (error) => {
      const tooMany = error instanceof ApiError && error.status === 400;
      toast(
        'error',
        tooMany ? 'Quantidade acima do estoque' : 'Não foi possível adicionar',
        error.message,
      );
    },
  });
}

/** Carrinho padrão para "Adicionar ao carrinho": o mais recente, ou um novo. */
export const defaultCartId = (carts: Cart[] | undefined): number | 'novo' =>
  carts?.length ? carts[carts.length - 1].id : 'novo';
