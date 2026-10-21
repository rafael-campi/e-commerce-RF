import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  api,
  ApiError,
  CardError,
  simulatePixPayment,
  tokenizeCard,
  type CardField,
} from '../lib/api';
import { testMode } from '../lib/test-mode';
import { useUser } from '../lib/auth';
import { brl, cartTotal, dateTime, methodLabel } from '../lib/format';
import type {
  Cart,
  PaymentAttempt,
  PaymentMethod,
  PaymentResult,
} from '../lib/types';
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
import {
  CardForm,
  checkCard,
  emptyCard,
  toTokenRequest,
  type CardFormValue,
} from './CardForm';

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  elo: 'Elo',
  hipercard: 'Hipercard',
  amex: 'American Express',
};

type CardSummary = { brand: string; last4: string } | null;

// a validação local do cartão falhou: os erros já estão nos campos
class CardFormInvalid extends Error {}

/** O que a confirmação precisa saber do Pedido recém-criado (o cliente não tem GET de Pedido). */
interface Receipt {
  payment: PaymentResult;
  cart: Cart;
  card?: CardSummary;
}

function ReceiptRows({
  payment,
  card,
  withOrder,
}: {
  payment: PaymentResult;
  card?: CardSummary;
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
          {card && (
            <span className="faint">
              · {BRANDS[card.brand] ?? card.brand} •••• {card.last4}
            </span>
          )}
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

/** "14:59" até o prazo do Pix; atualiza a cada segundo. */
function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!until) return null;
  const left = Math.max(0, Math.floor((Date.parse(until) - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return { left, label: `${mm}:${ss}` };
}

/**
 * Acompanha uma Tentativa pendente até o PSP decidir (o webhook chega na
 * API; aqui consultamos a cada 2 s) e avisa quando ela vira Pedido.
 */
function useTrackedAttempt(
  initial: PaymentAttempt,
  onPaid: (order: PaymentResult) => void,
) {
  const tracked = useQuery({
    queryKey: ['payment-attempt', initial.id],
    queryFn: () => api.paymentAttempt(initial.id),
    initialData: initial,
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 2000 : false),
  });
  const attempt = tracked.data;

  useEffect(() => {
    if (attempt.status === 'succeeded' && attempt.order) onPaid(attempt.order);
  }, [attempt, onPaid]);

  return tracked;
}

const ENDED: Record<string, { title: string; msg: string }> = {
  expired: {
    title: 'O Pix expirou',
    msg: 'O prazo para pagar acabou e nada foi cobrado. Os itens voltaram ao estoque e o carrinho continua salvo.',
  },
  canceled: {
    title: 'Pagamento cancelado',
    msg: 'Nada foi cobrado. O carrinho continua salvo para você pagar de outra forma.',
  },
  failed: {
    title: 'O pagamento não foi aprovado',
    msg: 'Nada foi cobrado e o carrinho continua salvo.',
  },
};

/**
 * Pix pendente: mostra o QR Code e acompanha a Tentativa até o PSP avisar
 * (por webhook, na API) que o dinheiro chegou.
 */
function PixWaiting({
  attempt: initial,
  onPaid,
  onRestart,
}: {
  attempt: PaymentAttempt;
  onPaid: (order: PaymentResult) => void;
  onRestart: () => void;
}) {
  const toast = useToast();
  const [qr, setQr] = useState<string | null>(null);
  const copiaECola = initial.pix?.copiaECola ?? '';

  const tracked = useTrackedAttempt(initial, onPaid);
  const attempt = tracked.data;
  const countdown = useCountdown(attempt.expiresAt);

  useEffect(() => {
    QRCode.toDataURL(copiaECola, { margin: 1, width: 232 }).then(setQr, () =>
      setQr(null),
    );
  }, [copiaECola]);

  const cancel = useMutation({
    mutationFn: () => api.cancelPaymentAttempt(attempt.id),
    onSuccess: (result) => {
      if (result.status === 'succeeded' && result.order) onPaid(result.order);
      else onRestart();
    },
    onError: (error) =>
      toast('error', 'Não foi possível cancelar', error.message),
  });

  const simulate = useMutation({
    mutationFn: () => simulatePixPayment(copiaECola),
    onSuccess: () => tracked.refetch(),
    onError: (error) => toast('error', 'Simulação falhou', error.message),
  });

  const copy = () => {
    const done = () => toast('info', 'Pix copia e cola copiado');
    navigator.clipboard?.writeText(copiaECola).then(done, done) ?? done();
  };

  if (ENDED[attempt.status])
    return <AttemptEnded attempt={attempt} onRestart={onRestart} />;

  return (
    <div className="receipt">
      <div
        className="panel panel-b"
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <div className="r-head">
          <div className="r-ic wait">
            <Icon name="pix" size={32} />
          </div>
          <h1 className="h2">Pague com Pix</h1>
          <p className="muted">
            Abra o app do seu banco, escolha pagar com Pix e escaneie o QR Code
            ou cole o código abaixo.
          </p>
        </div>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          {qr ? (
            <img
              src={qr}
              width={232}
              height={232}
              alt={`QR Code Pix de ${brl(attempt.amount)}`}
              style={{ borderRadius: 8, background: '#fff' }}
            />
          ) : (
            <div className="skel" style={{ width: 232, height: 232 }} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="eyebrow">Pix copia e cola</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code
              className="mono"
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {copiaECola}
            </code>
            <button
              className="btn btn-secondary btn-sm"
              onClick={copy}
              aria-label="Copiar Pix copia e cola"
            >
              <Icon name="copy" size={14} />
              Copiar
            </button>
          </div>
        </div>
        <hr className="divider" />
        <div className="r-rows">
          <div className="r-row">
            <span>Status</span>
            <span className="badge b-warning" aria-live="polite">
              Aguardando pagamento
            </span>
          </div>
          <div className="r-row">
            <span>Valor</span>
            <strong className="num">{brl(attempt.amount)}</strong>
          </div>
          {countdown && (
            <div className="r-row">
              <span>Expira em</span>
              <span
                className="num"
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <Icon name="clock" size={14} />
                {countdown.label}
              </span>
            </div>
          )}
        </div>
        <p className="help">
          <Icon name="shield" size={14} />
          <span>
            Assim que o banco confirmar, esta página mostra o pedido. Você pode
            deixá-la aberta.
          </span>
        </p>
        <div className="r-acts">
          {testMode && (
            <button
              className={`btn btn-primary${simulate.isPending ? ' is-loading' : ''}`}
              onClick={() => simulate.mutate()}
            >
              Simular pagamento (teste)
            </button>
          )}
          <button
            className={`btn btn-secondary${cancel.isPending ? ' is-loading' : ''}`}
            onClick={() => cancel.mutate()}
          >
            Cancelar e escolher outra forma
          </button>
        </div>
      </div>
    </div>
  );
}

function AttemptWaiting(props: {
  attempt: PaymentAttempt;
  onPaid: (order: PaymentResult) => void;
  onRestart: () => void;
}) {
  return props.attempt.pix ? (
    <PixWaiting {...props} />
  ) : (
    <CardProcessing {...props} />
  );
}

function AttemptEnded({
  attempt,
  onRestart,
}: {
  attempt: PaymentAttempt;
  onRestart: () => void;
}) {
  const ended = ENDED[attempt.status];
  return (
    <div className="receipt">
      <Alert
        tone="danger"
        title={ended.title}
        actions={
          <button className="btn btn-primary btn-sm" onClick={onRestart}>
            Escolher como pagar
          </button>
        }
      >
        {attempt.failure ? `${attempt.failure.message} ` : ''}
        {ended.msg}
      </Alert>
    </div>
  );
}

/**
 * Cartão pendente: a operadora não respondeu a tempo. O PSP tenta de novo
 * (sem cobrar duas vezes) e avisa o resultado; aqui só esperamos.
 */
function CardProcessing({
  attempt: initial,
  onPaid,
  onRestart,
}: {
  attempt: PaymentAttempt;
  onPaid: (order: PaymentResult) => void;
  onRestart: () => void;
}) {
  const attempt = useTrackedAttempt(initial, onPaid).data;

  if (ENDED[attempt.status])
    return <AttemptEnded attempt={attempt} onRestart={onRestart} />;

  return (
    <div className="receipt">
      <div className="panel panel-b r-head" aria-live="polite">
        <div className="r-ic wait">
          <Icon name="card" size={32} />
        </div>
        <h1 className="h2">Confirmando com a operadora</h1>
        <p className="muted">
          A operadora do cartão está demorando a responder. Isso costuma levar
          poucos segundos e você não será cobrado duas vezes. Não feche esta
          página.
        </p>
        <span className="badge b-warning">
          Processando {brl(attempt.amount)}
        </span>
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
  const [waiting, setWaiting] = useState<{
    attempt: PaymentAttempt;
    cart: Cart;
  } | null>(null);
  const [problem, setProblem] = useState<{ title: string; msg: string } | null>(
    null,
  );
  const config = useQuery({
    queryKey: ['checkout-config'],
    queryFn: api.checkoutConfig,
    staleTime: Infinity,
  });
  const cardConfig = config.data?.card ?? null;
  const [card, setCard] = useState<CardFormValue>(emptyCard);
  const [cardErrors, setCardErrors] = useState<
    Partial<Record<CardField, string>>
  >({});

  const cart = carts.data?.find((c) => c.id === cartId);

  const pay = useMutation({
    mutationFn: async (c: Cart) => {
      if (method !== 'credit_card' || !cardConfig) return api.pay(c.id, method);

      // o cartão vai do navegador direto ao PSP; a loja recebe só o token
      const errors = checkCard(card);
      setCardErrors(errors);
      if (Object.keys(errors).length) throw new CardFormInvalid();
      const token = await tokenizeCard(cardConfig, toTokenRequest(card));
      return api.pay(c.id, 'credit_card', {
        token: token.id,
        installments: card.installments,
      });
    },
    onSuccess: async (attempt, c) => {
      // guarda o carrinho antes: depois do refresh ele some da lista
      if (attempt.status === 'succeeded' && attempt.order)
        setDone({ payment: attempt.order, cart: c, card: attempt.card });
      else setWaiting({ attempt, cart: c });
      setCard(emptyCard);
      await refresh();
    },
    onError: async (error) => {
      if (error instanceof CardFormInvalid) return;
      if (error instanceof CardError) {
        if (error.field) setCardErrors({ [error.field]: error.message });
        else setProblem({ title: 'Cartão não aceito', msg: error.message });
        return;
      }
      const status = error instanceof ApiError ? error.status : 0;
      if (status === 402)
        setProblem({
          title: 'O pagamento não foi aprovado',
          msg: `${error.message} Nada foi cobrado e o carrinho continua salvo.`,
        });
      else if (status === 409 && /estoque/i.test(error.message))
        setProblem({
          title: 'Estoque insuficiente',
          msg: 'Algum item deste carrinho não tem mais estoque suficiente. Ajuste a quantidade e tente de novo.',
        });
      else if (status === 402 || status === 502)
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
                <ReceiptRows payment={done.payment} card={done.card} />
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

  if (waiting)
    return (
      <>
        <Header />
        <main className="page">
          <CheckoutSteps current={1} />
          <AttemptWaiting
            attempt={waiting.attempt}
            onPaid={(order) => {
              setDone({
                payment: order,
                cart: waiting.cart,
                card: waiting.attempt.card,
              });
              setWaiting(null);
              void refresh();
            }}
            onRestart={() => {
              setWaiting(null);
              void refresh();
            }}
          />
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
                    [
                      'pix',
                      'pix',
                      'Pix',
                      'QR Code no app do banco · confirmação em segundos',
                    ],
                    [
                      'credit_card',
                      'card',
                      'Cartão de crédito',
                      'Visa, Mastercard, Elo e Hipercard · até 3× sem juros',
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
              {method === 'credit_card' && cardConfig && (
                <CardForm
                  value={card}
                  onChange={(next) => {
                    setCard(next);
                    setCardErrors({});
                  }}
                  errors={cardErrors}
                  total={cartTotal(cart)}
                  disabled={busy}
                />
              )}
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
            <ReceiptRows payment={payment} card={state.card} withOrder />
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
