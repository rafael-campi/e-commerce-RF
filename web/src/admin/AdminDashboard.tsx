import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useDevice } from '../lib/device';
import {
  brl,
  date,
  dayMonth,
  fullName,
  initials,
  spDay,
  stockInfo,
} from '../lib/format';
import type { Metrics, Order } from '../lib/types';
import {
  Alert,
  Art,
  Field,
  RoleBadge,
  Skel,
  StateBlock,
} from '../ui/components';
import {
  BarChart,
  deltaPct,
  Donut,
  Kpi,
  KpiSkel,
  LineChart,
} from '../ui/charts';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { useProducts } from '../store/queries';
import { AdminShell, TableSkel, useOrders, useUsers } from './AdminShell';
import { OrderDrawer, OrdersTable } from './AdminOrders';

type Period = 'hoje' | '7d' | '30d' | 'custom';
const PERIODS: [Period, string][] = [
  ['hoje', 'Hoje'],
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['custom', 'Personalizado'],
];
const periodName: Record<Period, string> = {
  hoje: 'hoje',
  '7d': 'últimos 7 dias',
  '30d': 'últimos 30 dias',
  custom: 'período personalizado',
};
const MAX_DAYS = 60;

const int = (v: number) => Math.round(v).toLocaleString('pt-BR');
const bucketLabel = (m: Metrics, start: string) =>
  m.granularity === '2h' ? `${start.slice(11, 13)}h` : dayMonth(start);

function rangeFor(period: Period, custom: { from: string; to: string }) {
  if (period === 'hoje') return { from: spDay(), to: spDay() };
  if (period === '7d') return { from: spDay(-6), to: spDay() };
  if (period === '30d') return { from: spDay(-29), to: spDay() };
  return custom;
}

/** CSV no padrão do Excel em português (";" e BOM), montado no navegador. */
function downloadCsv(m: Metrics) {
  const rows = [
    ['Período', 'Receita (R$)', 'Pedidos pagos', 'Novos cadastros'],
    ...m.series.map((b) => [
      m.granularity === '2h'
        ? `${dayMonth(b.start.slice(0, 10))} ${b.start.slice(11)}`
        : dayMonth(b.start),
      b.revenue.toFixed(2).replace('.', ','),
      String(b.orders),
      String(b.signups),
    ]),
    [
      'Total',
      m.revenue.toFixed(2).replace('.', ','),
      String(m.paidOrders),
      String(m.newUsers),
    ],
  ];
  const csv = '﻿' + rows.map((r) => r.join(';')).join('\r\n');
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `prateleira-metricas-${m.from}-a-${m.to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const EmptyBox = ({ msg }: { msg?: string }) => (
  <StateBlock icon="calendar" title="Sem dados neste período">
    {msg}
  </StateBlock>
);

function RangeForm({
  value,
  onApply,
}: {
  value: { from: string; to: string };
  onApply: (v: { from: string; to: string }) => void;
}) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError('Escolha as duas datas.');
    const [a, b] = from <= to ? [from, to] : [to, from];
    const days = (Date.parse(b) - Date.parse(a)) / 86400_000 + 1;
    if (days > MAX_DAYS)
      return setError(`O período pode ter no máximo ${MAX_DAYS} dias.`);
    setError('');
    setFrom(a);
    setTo(b);
    onApply({ from: a, to: b });
  };

  return (
    <form className="range" onSubmit={submit} noValidate>
      <Field
        id="r-from"
        label="De"
        type="date"
        value={from}
        onChange={setFrom}
      />
      <Field id="r-to" label="Até" type="date" value={to} onChange={setTo} />
      <button
        className="btn btn-primary btn-sm"
        type="submit"
        style={{ height: 38 }}
      >
        Aplicar
      </button>
      {error ? (
        <p className="help err">
          <Icon name="alert-circle" size={14} />
          <span>{error}</span>
        </p>
      ) : (
        <span className="small faint">Máximo de {MAX_DAYS} dias</span>
      )}
    </form>
  );
}

function DashboardSkeleton() {
  const mobile = useDevice() === 'mobile';
  return (
    <>
      <div className="kpis" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <KpiSkel key={i} spark={!mobile} />
        ))}
      </div>
      <div className="charts">
        <div className="panel chart-p span2">
          <Skel w="40%" h={18} />
          <div className="skel" style={{ height: 220 }} />
        </div>
        <div className="panel chart-p">
          <Skel w="60%" h={18} />
          <div
            className="skel"
            style={{
              height: 160,
              width: 160,
              borderRadius: '50%',
              margin: '20px auto',
            }}
          />
        </div>
      </div>
      <div className="charts2">
        {[0, 1].map((i) => (
          <div className="panel chart-p" key={i}>
            <Skel w="50%" h={18} />
            <div className="skel" style={{ height: 180 }} />
          </div>
        ))}
      </div>
      <TableSkel cols={4} rows={5} />
    </>
  );
}

export function AdminDashboardPage() {
  const mobile = useDevice() === 'mobile';
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('7d');
  const [custom, setCustom] = useState({ from: spDay(-13), to: spDay() });
  const range = rangeFor(period, custom);

  const metrics = useQuery({
    queryKey: ['metrics', range.from, range.to],
    queryFn: () => api.metrics(range.from, range.to),
    placeholderData: keepPreviousData,
  });
  const products = useProducts();
  const orders = useOrders();
  const users = useUsers();
  const [openOrder, setOpenOrder] = useState<Order | null>(null);

  const m = metrics.data;
  const updatedAt = metrics.dataUpdatedAt
    ? new Date(metrics.dataUpdatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const head = (
    <>
      <div className="dash-head">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="muted">
            Vendas, clientes e estoque da loja
            {updatedAt ? ` · atualizado às ${updatedAt}` : ''}
          </p>
        </div>
        <div className="dash-tools">
          <div className="seg" role="group" aria-label="Período">
            {PERIODS.map(([k, label]) => (
              <button
                key={k}
                aria-pressed={period === k}
                onClick={() => setPeriod(k)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-secondary"
            disabled={!m || metrics.isFetching}
            onClick={() => {
              if (!m) return;
              downloadCsv(m);
              toast(
                'success',
                'Exportação concluída',
                `Relatório de ${periodName[period]} em CSV.`,
              );
            }}
          >
            <Icon name="download" size={18} />
            Exportar
          </button>
        </div>
      </div>
      {period === 'custom' && <RangeForm value={custom} onApply={setCustom} />}
    </>
  );

  if (metrics.isPending)
    return (
      <AdminShell crumb="Dashboard">
        {head}
        <DashboardSkeleton />
      </AdminShell>
    );

  if (metrics.isError || !m)
    return (
      <AdminShell crumb="Dashboard">
        {head}
        <Alert
          tone="danger"
          title="Não foi possível carregar as métricas"
          actions={
            <button
              className="btn btn-primary btn-sm"
              onClick={() => metrics.refetch()}
            >
              <Icon name="refresh" size={16} />
              Tentar novamente
            </button>
          }
        >
          O serviço de métricas não respondeu ({metrics.error?.message}). Os
          dados da loja não foram afetados.
        </Alert>
        <div className="kpis">
          {[
            'Receita total',
            'Pedidos pagos',
            'Ticket médio',
            'Novos usuários',
            'Carrinhos abertos',
            'Estoque baixo',
          ].map((label) => (
            <div className="panel kpi" key={label}>
              <div className="kpi-top">{label}</div>
              <span className="kpi-v faint">—</span>
              <div className="kpi-f">Sem dados</div>
            </div>
          ))}
        </div>
      </AdminShell>
    );

  const empty = m.paidOrders === 0;
  const labels = m.series.map((b) => bucketLabel(m, b.start));
  const unit = m.granularity === '2h' ? 'faixa de 2 h' : 'dia';
  const low = (products.data ?? [])
    .filter((p) => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock);
  const recentUsers = [...(users.data ?? [])]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  const share = (n: number) => Math.round((n / (m.paidOrders || 1)) * 100);

  return (
    <AdminShell crumb="Dashboard">
      {head}
      {empty && (
        <Alert tone="info" title="Nenhum pedido neste período">
          Os indicadores e gráficos aparecem assim que houver vendas. Tente “30
          dias”.
        </Alert>
      )}

      <div className="kpis" aria-busy={metrics.isFetching}>
        <Kpi
          icon="receipt"
          label="Receita total"
          value={brl(m.revenue)}
          delta={deltaPct(m.revenue, m.previous.revenue)}
          values={empty ? undefined : m.series.map((b) => b.revenue)}
        />
        <Kpi
          icon="check-circle"
          label="Pedidos pagos"
          value={int(m.paidOrders)}
          delta={deltaPct(m.paidOrders, m.previous.paidOrders)}
          values={empty ? undefined : m.series.map((b) => b.orders)}
        />
        <Kpi
          icon="bag"
          label="Ticket médio"
          value={brl(m.averageTicket)}
          delta={deltaPct(m.averageTicket, m.previous.averageTicket)}
        />
        <Kpi
          icon="users"
          label="Novos usuários"
          value={int(m.newUsers)}
          delta={deltaPct(m.newUsers, m.previous.newUsers)}
          foot={
            m.previous.newUsers
              ? undefined
              : 'sem cadastros no período anterior para comparar'
          }
          values={m.newUsers ? m.series.map((b) => b.signups) : undefined}
        />
        <Kpi
          icon="cart"
          label="Carrinhos abertos"
          value={int(m.openCarts)}
          foot="ainda não pagos, agora"
        />
        <Kpi
          icon="alert-triangle"
          label="Estoque baixo"
          value={`${low.length} ${low.length === 1 ? 'produto' : 'produtos'}`}
          foot={
            <>
              com 5 unidades ou menos ·{' '}
              <Link to="/admin/produtos">ver produtos</Link>
            </>
          }
        />
      </div>

      <div className="charts">
        <section className="panel chart-p span2">
          <div className="chart-h">
            <div>
              <h2 className="h4">Receita ao longo do tempo</h2>
              <p className="faint">Pedidos pagos, por {unit}</p>
            </div>
            <strong className="price">{brl(m.revenue)}</strong>
          </div>
          {empty ? (
            <EmptyBox msg="Nenhum pedido foi registrado. Escolha outro período." />
          ) : (
            <LineChart
              labels={labels}
              values={m.series.map((b) => b.revenue)}
              label={`Receita por ${unit}`}
              tip={(i) =>
                `${labels[i]} · ${brl(m.series[i].revenue)} · ${m.series[i].orders} pedidos`
              }
            />
          )}
        </section>
        <section className="panel chart-p">
          <div className="chart-h">
            <div>
              <h2 className="h4">Pedidos por método</h2>
              <p className="faint">Pix × cartão de crédito</p>
            </div>
          </div>
          {empty ? (
            <EmptyBox />
          ) : (
            <div className="donut-wrap">
              <Donut
                a={m.byMethod.pix}
                b={m.byMethod.credit_card}
                labelA="Pix"
                labelB="Cartão de crédito"
              />
              <div className="donut-legend">
                {(
                  [
                    ['var(--c1)', 'Pix', m.byMethod.pix],
                    ['var(--c2)', 'Cartão de crédito', m.byMethod.credit_card],
                  ] as const
                ).map(([color, name, n]) => (
                  <div className="dl-i" key={name}>
                    <i style={{ background: color }} />
                    <div>
                      <span className="muted">{name}</span>
                      <b>{share(n)}%</b>
                      <span className="small faint">{int(n)} pedidos</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="charts2">
        <section className="panel chart-p">
          <div className="chart-h">
            <div>
              <h2 className="h4">Pedidos pagos</h2>
              <p className="faint">Por {unit}</p>
            </div>
            <strong className="price">{int(m.paidOrders)}</strong>
          </div>
          {empty ? (
            <EmptyBox />
          ) : (
            <BarChart
              labels={labels}
              values={m.series.map((b) => b.orders)}
              color="var(--c2)"
              label={`Pedidos pagos por ${unit}`}
              tip={(i) => `${labels[i]} · ${m.series[i].orders} pedidos`}
            />
          )}
        </section>
        <section className="panel chart-p">
          <div className="chart-h">
            <div>
              <h2 className="h4">Novos cadastros</h2>
              <p className="faint">Por {unit}</p>
            </div>
            <strong className="price">{int(m.newUsers)}</strong>
          </div>
          {m.newUsers === 0 ? (
            <EmptyBox msg="Ninguém se cadastrou neste período." />
          ) : (
            <BarChart
              labels={labels}
              values={m.series.map((b) => b.signups)}
              label={`Novos cadastros por ${unit}`}
              tip={(i) => `${labels[i]} · ${m.series[i].signups} cadastros`}
            />
          )}
        </section>
      </div>

      <div className="tables">
        <section className="panel">
          <div className="panel-h">
            <h2 className="h4">Produtos mais vendidos</h2>
            <span className="faint small">por receita</span>
          </div>
          {!m.topProducts.length ? (
            <EmptyBox />
          ) : mobile ? (
            <div className="mlist">
              {m.topProducts.map((t, i) => (
                <div className="mrow" key={t.productId}>
                  <span className="rank">{i + 1}</span>
                  <div className="grow">
                    <b>{t.name}</b>
                    <span className="small faint num">
                      {int(t.units)} unidades
                    </span>
                  </div>
                  <strong className="num">{brl(t.revenue)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="r">Unidades</th>
                    <th className="r">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {m.topProducts.map((t, i) => (
                    <tr key={t.productId}>
                      <td>
                        <div className="c-prod">
                          <span className="rank">{i + 1}</span>
                          <b>{t.name}</b>
                        </div>
                      </td>
                      <td className="r num">{int(t.units)}</td>
                      <td className="r num">{brl(t.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2
              className="h4"
              style={{ display: 'flex', gap: 8, alignItems: 'center' }}
            >
              <Icon name="alert-triangle" size={18} />
              Estoque baixo ou esgotado
            </h2>
            <span className="badge b-warning">{low.length}</span>
          </div>
          {!low.length ? (
            <div className="panel-b muted">
              Nenhum produto com estoque baixo.
            </div>
          ) : (
            <div className="mlist">
              {low.map((p) => (
                <div className="mrow" key={p.id}>
                  <Art productId={p.id} size={18} className="thumb" />
                  <div className="grow">
                    <b>{p.name}</b>
                    <span className="small faint num">
                      Estoque atual: {p.stock}
                    </span>
                  </div>
                  <span className={`badge b-${stockInfo(p).cls}`}>
                    {p.stock === 0 ? 'Esgotado' : 'Baixo'}
                  </span>
                  <Link
                    className="btn btn-secondary btn-sm"
                    to={`/admin/produtos?editar=${p.id}`}
                  >
                    Repor
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="tables3">
        <section className="panel">
          <div className="panel-h">
            <h2 className="h4">Últimos pedidos</h2>
            <Link className="btn btn-ghost btn-sm" to="/admin/pedidos">
              Ver todos
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
          {orders.data?.length ? (
            <OrdersTable
              orders={orders.data.slice(0, 6)}
              onOpen={setOpenOrder}
            />
          ) : (
            <div className="panel-b muted">Nenhum pedido ainda.</div>
          )}
        </section>
        <section className="panel">
          <div className="panel-h">
            <h2 className="h4">Usuários recentes</h2>
            <Link className="btn btn-ghost btn-sm" to="/admin/usuarios">
              Ver todos
              <Icon name="chevron-right" size={16} />
            </Link>
          </div>
          <div className="mlist">
            {recentUsers.map((u) => (
              <div className="mrow" key={u.id}>
                <span className="avatar">{initials(u)}</span>
                <div className="grow">
                  <b>{fullName(u)}</b>
                  <span className="small faint num">
                    Cadastro em {date(u.createdAt)}
                  </span>
                </div>
                <RoleBadge role={u.role} />
              </div>
            ))}
          </div>
        </section>
      </div>
      {openOrder && (
        <OrderDrawer order={openOrder} onClose={() => setOpenOrder(null)} />
      )}
    </AdminShell>
  );
}
