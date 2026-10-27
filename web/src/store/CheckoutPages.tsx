import { useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useUser } from '../lib/auth';
import { brl, cartTotal, dateTime, methodLabel } from '../lib/format';
import type { Cart, PaymentMethod, PaymentResult } from '../lib/types';
import {
  Alert,
  Art,
  CheckoutSteps,
  LoadError,
  StateBlock,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { Header } from './Header';
import { useCarts, useRefreshShop } from './queries';

/** O que a confirmação precisa saber do Pedido recém-criado (o cliente não tem GET de Pedido). */
interface Receipt {
  payment: PaymentResult;
  cart: Cart;
}

function ReceiptRows({
  payment,
  withOrder,
}: {
  payment: PaymentResult;
  withOrder?: boolean;
}) {
  const toast = useToast();
  const copy = () => {
    const done = () =>
      toast('info', 'Referência copiada', payment.gatewayReference);
    navigator.clipboard?.writeText(payment.gatewayReference).then(done, done) ??
      done();
  };
  return (
    <div className="r-rows">
      <div className="r-row">
        <span>Referência</span>
        <button
          className="copy mono"
          onClick={copy}
          aria-label={`Copiar referência ${payment.gatewayReference}`}
        >
          {payment.gatewayReference}
          <Icon name="copy" size={14} />
        </button>
      </div>
      <div className="r-row">
        <span>Status do pagamento</span>
        <span className="badge b-success">Pago</span>
      </div>
      <div className="r-row">
        <span>Valor</span>
        <strong className="num">{brl(payment.amount)}</strong>
      </div>
      <div className="r-row">
        <span>Método</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Icon
            name={payment.payment_method === 'pix' ? 'pix' : 'card'}
            size={16}
          />
          {methodLabel(payment.payment_method)}
        </span>
      </div>
      {withOrder && (
        <div className="r-row">
          <span>Pedido</span>
          <span className="mono">#{payment.id}</span>
        </div>
      )}
      <div className="r-row">
        <span>Data</span>
        <span className="num">{dateTime(payment.createdAt)}</span>
      </div>
    </div>
  );
}

export function PaymentPage() {
  const cartId = Number(useParams().id);
  const navigate = useNavigate();
  const refresh = useRefreshShop();
  const carts = useCarts();
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [done, setDone] = useState<Receipt | null>(null);
  const [problem, setProblem] = useState<{ title: string; msg: string } | null>(
    null,
  );

  const cart = carts.data?.find((c) => c.id === cartId);

  const pay = useMutation({
    mutationFn: (c: Cart) => api.pay(c.id, method),
    onSuccess: async (payment, c) => {
      setDone({ payment, cart: c }); // guarda antes: depois do refresh o carrinho some da lista
      await refresh();
    },
    onError: async (error) => {
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 409 && /estoque/i.test(error.message))
        setProblem({
          title: 'Estoque insuficiente',
          msg: 'Algum item deste carrinho não tem mais estoque suficiente. Ajuste a quantidade e tente de novo.',
        });
      else if (status === 502)
        setProblem({
          title: 'O pagamento não foi aprovado',
          msg: 'A operadora recusou ou não respondeu. Nada foi cobrado e o carrinho continua salvo.',
        });
      else setProblem({ title: 'Não foi possível pagar', msg: error.message });
      await refresh();
    },
  });

  if (done)
    return (
      <>
        <Header />
        <main className="page">
          <CheckoutSteps current={2} />
          <div className="receipt">
            <div
              className="panel panel-b"
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <div className="r-head">
                <div className="r-ic ok">
                  <Icon name="check" size={32} />
                </div>
                <h1 className="h2">Pagamento aprovado</h1>
                <p className="muted">
                  Guarde a referência abaixo. Ela identifica o pagamento no
                  suporte.
                </p>
              </div>
              <hr className="divider" />
              <div>
                <p className="eyebrow" style={{ marginBottom: 4 }}>
                  Comprovante
                </p>
                <ReceiptRows payment={done.payment} />
              </div>
              <div className="r-acts">
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    navigate(`/pedidos/${done.payment.id}`, { state: done })
                  }
                >
                  Ver pedido
                </button>
                <Link className="btn btn-secondary" to="/produtos">
                  Continuar comprando
                </Link>
              </div>
            </div>
          </div>
        </main>
      </>
    );

  let content;
  if (carts.isPending)
    content = (
      <div className="two-col">
        <div className="skel" style={{ height: 260, borderRadius: 14 }} />
        <div className="skel" style={{ height: 260, borderRadius: 14 }} />
      </div>
    );
  else if (carts.isError)
    content = (
      <LoadError
        what="o carrinho"
        code="GET /cart"
        onRetry={() => carts.refetch()}
      />
    );
  else if (!cart)
    content = (
      <StateBlock
        tone="danger"
        icon="cart"
        code="Carrinho inválido"
        title="Carrinho inválido"
        boxed
        actions={
          <Link className="btn btn-primary" to="/carrinhos">
            Voltar aos carrinhos
          </Link>
        }
      >
        O carrinho #{cartId} não existe mais ou já foi pago. Escolha outro
        carrinho para continuar.
      </StateBlock>
    );
  else {
    const total = cartTotal(cart);
    const busy = pay.isPending;
    content = (
      <>
        <Link className="back" to="/carrinhos">
          <Icon name="arrow-left" size={18} />
          Voltar aos carrinhos
        </Link>
        <div className="two-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 className="h1">Pagamento</h1>
              <p className="muted">
                Carrinho #{cart.id} · escolha como quer pagar.
              </p>
            </div>
            {problem && (
              <Alert
                tone="danger"
                title={problem.title}
                actions={
                  <Link className="btn btn-secondary btn-sm" to="/carrinhos">
                    Ajustar carrinho
                  </Link>
                }
              >
                {problem.msg}
              </Alert>
            )}
            <div
              className="panel panel-b"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <h2 className="h4">Forma de pagamento</h2>
              <div
                className="rcards"
                role="radiogroup"
                aria-label="Forma de pagamento"
              >
                {(
                  [
                    ['pix', 'pix', 'Pix', 'Aprovação na hora'],
                    [
                      'credit_card',
                      'card',
                      'Cartão de crédito',
                      'Visa, Mastercard e Elo · até 3× sem juros',
                    ],
                  ] as const
                ).map(([value, icon, title, desc]) => (
                  <button
                    key={value}
                    type="button"
                    className="rcard"
                    role="radio"
                    aria-checked={method === value}
                    disabled={busy}
                    onClick={() => setMethod(value)}
                  >
                    <span className="radio" />
                    <span className="rc-ic">
                      <Icon name={icon} size={20} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span className="rc-t">{title}</span>
                      <br />
                      <span className="rc-d">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="help">
                <Icon name="shield" size={14} />
                <span>
                  Pagamento processado com conexão criptografada. A Prateleira
                  não guarda os dados do seu cartão.
                </span>
              </p>
            </div>
          </div>
          <aside className="aside">
            <div
              className="panel panel-b"
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <h2 className="h4">Resumo do carrinho #{cart.id}</h2>
              <div className="sum-items">
                {cart.cartItem.map((i) => (
                  <div className="sum-i" key={i.id}>
                    <Art productId={i.product.id} size={20} className="thumb" />
                    <div className="si-n">
                      <b>{i.product.name}</b>
                      <span className="faint num">
                        {i.quantity} × {brl(i.product.price)}
                      </span>
                    </div>
                    <span className="num">
                      {brl(Number(i.product.price) * i.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <hr className="divider" />
              <div className="kv total">
                <span>Total</span>
                <span className="num">{brl(total)}</span>
              </div>
              <button
                className={`btn btn-primary btn-lg btn-block${busy ? ' is-loading' : ''}`}
                onClick={() => {
                  setProblem(null);
                  pay.mutate(cart);
                }}
              >
                Pagar {brl(total)}
              </button>
              {busy && (
                <p
                  className="small faint"
                  style={{ textAlign: 'center' }}
                  aria-live="polite"
                >
                  Processando pagamento com{' '}
                  {method === 'pix' ? 'Pix' : 'cartão'}… não feche esta página.
                </p>
              )}
            </div>
          </aside>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="page">
        <CheckoutSteps current={1} />
        {content}
      </main>
    </>
  );
}

export function ConfirmationPage() {
  const user = useUser();
  const state = useLocation().state as Receipt | null;

  // sem os dados da compra (ex.: página recarregada) não há o que confirmar
  if (!state?.payment) return <Navigate to="/produtos" replace />;
  const { payment, cart } = state;

  return (
    <>
      <Header />
      <main className="page">
        <CheckoutSteps current={3} />
        <div className="receipt">
          <div
            className="panel panel-b"
            style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <div className="r-head">
              <div className="r-ic ok">
                <Icon name="check-circle" size={32} />
              </div>
              <h1 className="h2">Pedido confirmado!</h1>
              <p className="muted">
                Obrigado, {user.firstName ?? user.email}. Seu pagamento foi
                aprovado e o pedido #{payment.id} está registrado.
              </p>
            </div>
            <div className="sum-items">
              {cart.cartItem.map((i) => (
                <div className="sum-i" key={i.id}>
                  <Art productId={i.product.id} size={20} className="thumb" />
                  <div className="si-n">
                    <b>{i.product.name}</b>
                    <span className="faint num">
                      {i.quantity} × {brl(i.product.price)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <hr className="divider" />
            <ReceiptRows payment={payment} withOrder />
            <div className="r-acts">
              <Link className="btn btn-primary btn-lg" to="/produtos">
                Continuar comprando
              </Link>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
