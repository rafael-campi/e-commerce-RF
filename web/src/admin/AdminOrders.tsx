import { useEffect, useState } from 'react';
import { useDevice } from '../lib/device';
import { brl, dateTime, fullName, methodLabel } from '../lib/format';
import type { Order } from '../lib/types';
import { Art, LoadError, StateBlock } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { AdminShell, TableSkel, useOrders } from './AdminShell';

function OrderDrawer({
  order: o,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const toast = useToast();
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
            <span className="badge b-success">Pago</span>
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
        </div>
      </aside>
    </div>
  );
}

export function AdminOrdersPage() {
  const mobile = useDevice() === 'mobile';
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
  else if (mobile)
    body = (
      <div className="panel mlist">
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
            onClick={() => setOpen(o)}
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
              <span className="badge b-success">Pago</span>
            </div>
          </button>
        ))}
      </div>
    );
  else
    body = (
      <div className="panel tbl-wrap">
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
              <tr key={o.id} className="clickable" onClick={() => setOpen(o)}>
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
                    onClick={() => setOpen(o)}
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
                  <span className="badge b-success">Pago</span>
                </td>
                <td className="num faint">{dateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
