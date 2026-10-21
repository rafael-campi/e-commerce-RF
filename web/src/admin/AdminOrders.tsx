import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useDevice } from '../lib/device';
import { brl, dateTime, fullName, methodLabel } from '../lib/format';
import type { Order } from '../lib/types';
import { Art, LoadError, Modal, StateBlock } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { AdminShell, TableSkel, useOrders } from './AdminShell';

const ORDER_STATUS: Record<Order['status'], [string, string]> = {
  paid: ['b-success', 'Pago'],
  refund_pending: ['b-warning', 'Estornando'],
  refunded: ['b-neutral', 'Estornado'],
};

function OrderStatus({ status }: { status: Order['status'] }) {
  const [tone, label] = ORDER_STATUS[status] ?? ORDER_STATUS.paid;
  return <span className={`badge ${tone}`}>{label}</span>;
}

/** Confirma o estorno: o valor inteiro volta ao Cliente e os itens ao Estoque. */
function RefundModal({
  order,
  onClose,
  onRefunded,
}: {
  order: Order;
  onClose: () => void;
  onRefunded: (order: Order) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const refund = useMutation({
    mutationFn: () => api.refundOrder(order.id),
    onSuccess: async (updated) => {
      // estoque, receita e saldo mudam junto com o pedido
      await Promise.all(
        ['orders', 'products', 'product', 'metrics', 'finance'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      if (updated.status === 'refunded')
        toast(
          'success',
          `Pedido #${order.id} estornado`,
          `${brl(order.amount)} devolvidos ao cliente`,
        );
      else
        toast(
          'info',
          'Estorno em andamento',
          'O gateway ainda não confirmou. O pedido atualiza sozinho.',
        );
      onRefunded(updated);
    },
    onError: (e) => setError(e.message),
  });

  return (
    <Modal label={`Estornar pedido ${order.id}`} small onClose={onClose}>
      <div
        className="panel-b"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h2 className="h3">Estornar o pedido #{order.id}?</h2>
        <p className="muted">
          {brl(order.amount)} voltam para {fullName(order.customer)} pelo mesmo
          meio de pagamento e os itens voltam ao estoque. A taxa do gateway não
          é devolvida. Não dá para desfazer.
        </p>
        {error && (
          <p className="help err">
            <Icon name="alert-circle" size={14} />
            <span>{error}</span>
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className={`btn btn-danger${refund.isPending ? ' is-loading' : ''}`}
            onClick={() => refund.mutate()}
          >
            Estornar {brl(order.amount)}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function OrderDrawer({
  order: initial,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const toast = useToast();
  // o estorno muda o pedido enquanto a gaveta está aberta
  const [o, setOrder] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = () => {
    const done = () => toast('info', 'Referência copiada', o.gatewayReference);
    navigator.clipboard?.writeText(o.gatewayReference).then(done, done) ??
      done();
  };

  return (
    <div
      className="drawer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <aside
        className="d-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${o.id}`}
      >
        <div className="d-head">
          <div>
            <p className="eyebrow">Pedido</p>
            <h2 className="h3 mono">#{o.id}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="d-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <OrderStatus status={o.status} />
            <span className="faint small num">{dateTime(o.createdAt)}</span>
          </div>
          <div className="r-rows">
            <div className="r-row">
              <span>Cliente</span>
              <b>{fullName(o.customer)}</b>
            </div>
            <div className="r-row">
              <span>Método</span>
              <span>{methodLabel(o.paymentMethod)}</span>
            </div>
            <div className="r-row">
              <span>Carrinho</span>
              <span className="mono">#{o.cartId}</span>
            </div>
            <div className="r-row">
              <span>Referência</span>
              <button className="copy mono" onClick={copy}>
                {o.gatewayReference}
                <Icon name="copy" size={14} />
              </button>
            </div>
          </div>
          <h3 className="h4">Itens</h3>
          <div className="sum-items">
            {o.items.map((i) => (
              <div className="sum-i" key={i.productId}>
                <Art productId={i.productId} size={18} className="thumb" />
                <div className="si-n">
                  <b>{i.name}</b>
                  <span className="faint num">
                    {i.quantity} × {brl(i.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <hr className="divider" />
          <div className="kv total">
            <span>Total cobrado</span>
            <span className="num">{brl(o.amount)}</span>
          </div>
          {o.refundedAt && (
            <p className="small faint">
              Estornado em {dateTime(o.refundedAt)}: o valor voltou ao cliente e
              os itens, ao estoque.
            </p>
          )}
          {o.status === 'paid' && (
            <button
              className="btn btn-secondary"
              onClick={() => setConfirming(true)}
            >
              <Icon name="refresh" size={16} />
              Estornar pedido
            </button>
          )}
        </div>
      </aside>
      {confirming && (
        <RefundModal
          order={o}
          onClose={() => setConfirming(false)}
          onRefunded={(updated) => {
            setOrder(updated);
            setConfirming(false);
          }}
        />
      )}
    </div>
  );
}

/** Lista de Pedidos (tabela no desktop, linhas no celular); sem o painel em volta. */
export function OrdersTable({
  orders: list,
  onOpen,
}: {
  orders: Order[];
  onOpen: (order: Order) => void;
}) {
  const mobile = useDevice() === 'mobile';
  if (mobile)
    return (
      <div className="mlist">
        {list.map((o) => (
          <button
            key={o.id}
            className="mrow"
            style={{
              border: 0,
              borderBottom: '1px solid var(--border)',
              background: 'none',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onClick={() => onOpen(o)}
          >
            <div className="grow">
              <b>
                #{o.id} · {fullName(o.customer)}
              </b>
              <span className="small faint">
                {dateTime(o.createdAt)} · {methodLabel(o.paymentMethod)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 4,
              }}
            >
              <strong className="num">{brl(o.amount)}</strong>
              <OrderStatus status={o.status} />
            </div>
          </button>
        ))}
      </div>
    );
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th className="r">Valor</th>
            <th>Método</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id} className="clickable" onClick={() => onOpen(o)}>
              <td>
                <button
                  className="mono"
                  style={{
                    border: 0,
                    background: 'none',
                    padding: 0,
                    color: 'var(--text-brand)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => onOpen(o)}
                >
                  #{o.id}
                </button>
              </td>
              <td>{fullName(o.customer)}</td>
              <td className="r num">{brl(o.amount)}</td>
              <td>
                <span
                  style={{
                    display: 'inline-flex',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <Icon
                    name={o.paymentMethod === 'pix' ? 'pix' : 'card'}
                    size={16}
                  />
                  {o.paymentMethod === 'pix' ? 'Pix' : 'Cartão'}
                </span>
              </td>
              <td>
                <OrderStatus status={o.status} />
              </td>
              <td className="num faint">{dateTime(o.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOrdersPage() {
  const orders = useOrders();
  const [open, setOpen] = useState<Order | null>(null);
  const list = orders.data ?? [];

  let body;
  if (orders.isPending) body = <TableSkel cols={6} rows={7} />;
  else if (orders.isError)
    body = (
      <LoadError
        what="os pedidos"
        code="GET /orders"
        onRetry={() => orders.refetch()}
      />
    );
  else if (!list.length)
    body = (
      <StateBlock icon="receipt" title="Nenhum pedido ainda" boxed>
        Quando os clientes pagarem um carrinho, os pedidos aparecem aqui.
      </StateBlock>
    );
  else
    body = (
      <div className="panel">
        <OrdersTable orders={list} onOpen={setOpen} />
      </div>
    );

  return (
    <AdminShell crumb="Pedidos">
      <div className="dash-head">
        <div>
          <h1 className="h1">Pedidos</h1>
          <p className="muted">
            Carrinhos pagos pelos clientes. Clique em um pedido para ver o
            detalhe.
          </p>
        </div>
      </div>
      {body}
      {open && <OrderDrawer order={open} onClose={() => setOpen(null)} />}
    </AdminShell>
  );
}
