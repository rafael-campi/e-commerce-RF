import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { brl, cartTotal, date } from '../lib/format';
import type { Cart, CartItem } from '../lib/types';
import {
  Alert,
  Art,
  LoadError,
  Modal,
  Skel,
  StateBlock,
  Stepper,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { Header } from './Header';
import { useCarts, useRefreshShop } from './queries';

const key = (cartId: number, productId: number) => `${cartId}:${productId}`;

function CartLine({
  cart,
  item,
  error,
  onQuantity,
  onRemove,
}: {
  cart: Cart;
  item: CartItem;
  error?: string;
  onQuantity: (n: number) => void;
  onRemove: () => void;
}) {
  const p = item.product;
  return (
    <div className={`citem${error ? ' is-error' : ''}`}>
      <Art productId={p.id} size={30} className="thumb" />
      <div>
        <div className="ci-n">{p.name}</div>
        <p className="small faint num">
          {brl(p.price)} / un. · {p.stock} em estoque
        </p>
      </div>
      <div className="ci-q">
        <Stepper
          value={item.quantity}
          max={p.stock}
          onChange={onQuantity}
          error={!!error}
          label={`Quantidade de ${p.name} no carrinho #${cart.id}`}
        />
      </div>
      <strong className="ci-sub num">
        {brl(Number(p.price) * item.quantity)}
      </strong>
      <button
        className="icon-btn danger ci-x"
        onClick={onRemove}
        aria-label={`Remover ${p.name}`}
      >
        <Icon name="trash" size={18} />
      </button>
      {error && (
        <div className="ci-err">
          <Alert tone="danger" title="Quantidade acima do estoque (400)" small>
            {error}
          </Alert>
        </div>
      )}
    </div>
  );
}

export function CartsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const refresh = useRefreshShop();
  const carts = useCarts();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<Cart | null>(null);

  const clearError = (k: string) =>
    setErrors(({ [k]: _removed, ...rest }) => rest);

  const setQuantity = useMutation({
    mutationFn: ({
      cart,
      item,
      quantity,
    }: {
      cart: Cart;
      item: CartItem;
      quantity: number;
    }) => api.setCartItem(cart.id, item.product.id, quantity),
    onSuccess: async (_, { cart, item }) => {
      clearError(key(cart.id, item.product.id));
      await refresh();
    },
    onError: (error, { cart, item, quantity }) => {
      const p = item.product;
      if (error instanceof ApiError && error.status === 400)
        setErrors((e) => ({
          ...e,
          [key(cart.id, p.id)]:
            `Você pediu ${quantity} unidades, mas só há ${p.stock} de ${p.name} em estoque. A quantidade continua em ${item.quantity}.`,
        }));
      else
        toast('error', 'Não foi possível alterar a quantidade', error.message);
    },
  });

  const removeItem = useMutation({
    mutationFn: ({ cart, item }: { cart: Cart; item: CartItem }) =>
      api.removeCartItem(cart.id, item.product.id),
    onSuccess: async (_, { cart, item }) => {
      clearError(key(cart.id, item.product.id));
      await refresh();
      toast(
        'success',
        'Item removido',
        `${item.product.name} saiu do carrinho #${cart.id}.`,
      );
    },
    onError: (error) =>
      toast('error', 'Não foi possível remover o item', error.message),
  });

  const removeCart = useMutation({
    mutationFn: (cart: Cart) => api.deleteCart(cart.id),
    onSuccess: async (_, cart) => {
      setConfirm(null);
      await refresh();
      toast('success', `Carrinho #${cart.id} removido`);
    },
    onError: (error) => {
      setConfirm(null);
      toast('error', 'Não foi possível remover o carrinho', error.message);
    },
  });

  const list = carts.data ?? [];

  const head = (
    <div className="page-head">
      <div>
        <p className="eyebrow">Compras</p>
        <h1 className="h1">Meus carrinhos</h1>
        {carts.isSuccess && list.length > 0 && (
          <p className="muted">
            {list.length}{' '}
            {list.length === 1 ? 'carrinho aberto' : 'carrinhos abertos'} · cada
            um é pago separadamente
          </p>
        )}
      </div>
      {list.length > 0 && (
        <Link className="btn btn-secondary" to="/produtos">
          <Icon name="plus" size={18} />
          Continuar comprando
        </Link>
      )}
    </div>
  );

  let body;
  if (carts.isPending)
    body = (
      <div className="two-col">
        <div className="carts">
          {[0, 1].map((i) => (
            <div className="panel" key={i}>
              <div className="cart-h">
                <Skel w="160px" h={20} />
              </div>
              {[0, 1].map((j) => (
                <div className="citem" key={j}>
                  <Skel w="72px" h={72} r={12} />
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  >
                    <Skel w="70%" h={16} />
                    <Skel w="40%" h={12} />
                  </div>
                  <Skel w="120px" h={40} r={10} />
                  <Skel w="80px" h={18} />
                  <span />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="skel" style={{ height: 180, borderRadius: 14 }} />
      </div>
    );
  else if (carts.isError)
    body = (
      <LoadError
        what="seus carrinhos"
        code="GET /cart"
        onRetry={() => carts.refetch()}
      />
    );
  else if (!list.length)
    body = (
      <StateBlock
        tone="brand"
        icon="cart"
        title="Você não tem carrinhos abertos"
        boxed
        actions={
          <Link className="btn btn-primary btn-lg" to="/produtos">
            Ver produtos
          </Link>
        }
      >
        Adicione produtos para montar um carrinho. Você pode ter mais de um e
        pagar cada um quando quiser.
      </StateBlock>
    );
  else {
    const all = list.reduce((s, c) => s + cartTotal(c), 0);
    body = (
      <div className="two-col">
        <div className="carts">
          {list.map((c) => {
            const invalid = c.cartItem.some(
              (i) => errors[key(c.id, i.product.id)],
            );
            return (
              <section
                className="panel"
                aria-label={`Carrinho ${c.id}`}
                key={c.id}
              >
                <div className="cart-h">
                  <Icon name="bag" size={20} />
                  <div className="h4">
                    Carrinho #{c.id}{' '}
                    <span className="faint small" style={{ fontWeight: 400 }}>
                      · criado em {date(c.createdAt)}
                    </span>
                  </div>
                  <button
                    className="btn btn-danger-ghost btn-sm"
                    onClick={() => setConfirm(c)}
                  >
                    <Icon name="trash" size={16} />
                    Remover carrinho
                  </button>
                </div>
                {c.cartItem.map((item) => (
                  <CartLine
                    key={item.id}
                    cart={c}
                    item={item}
                    error={errors[key(c.id, item.product.id)]}
                    onQuantity={(quantity) =>
                      setQuantity.mutate({ cart: c, item, quantity })
                    }
                    onRemove={() => removeItem.mutate({ cart: c, item })}
                  />
                ))}
                <div className="cart-f">
                  <div className="tot">
                    <span className="faint small">Total do carrinho</span>
                    <strong className="price">{brl(cartTotal(c))}</strong>
                  </div>
                  <button
                    className="btn btn-primary btn-lg"
                    disabled={invalid || !c.cartItem.length}
                    onClick={() => navigate(`/carrinhos/${c.id}/pagamento`)}
                  >
                    Ir para pagamento
                    <Icon name="chevron-right" size={18} />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        <aside className="aside">
          <div
            className="panel panel-b"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h2 className="h4">Resumo</h2>
            {list.map((c) => (
              <div className="kv" key={c.id}>
                <span>Carrinho #{c.id}</span>
                <span className="num">{brl(cartTotal(c))}</span>
              </div>
            ))}
            <hr className="divider" />
            <div className="kv total">
              <span>Soma dos carrinhos</span>
              <span className="num">{brl(all)}</span>
            </div>
            <p className="small faint">
              O pagamento é feito por carrinho. Escolha qual pagar com o botão
              “Ir para pagamento”.
            </p>
          </div>
          <Alert tone="info" title="Estoque reservado no pagamento">
            As quantidades são conferidas com o estoque no momento em que você
            paga.
          </Alert>
        </aside>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="page">
        {head}
        {body}
      </main>
      {confirm && (
        <Modal
          small
          label={`Remover o carrinho #${confirm.id}`}
          onClose={() => setConfirm(null)}
        >
          <div className="m-head">
            <div className="m-ic danger">
              <Icon name="trash" size={22} />
            </div>
            <div className="grow">
              <h2 className="h3">Remover o carrinho #{confirm.id}?</h2>
              <p className="muted">
                {confirm.cartItem.length === 1
                  ? 'O item deste carrinho será descartado.'
                  : `Os ${confirm.cartItem.length} itens deste carrinho serão descartados.`}{' '}
                Seus outros carrinhos continuam salvos.
              </p>
            </div>
          </div>
          <div className="m-foot" style={{ border: 0 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirm(null)}
            >
              Cancelar
            </button>
            <button
              className={`btn btn-danger${removeCart.isPending ? ' is-loading' : ''}`}
              onClick={() => removeCart.mutate(confirm)}
            >
              Remover carrinho
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
