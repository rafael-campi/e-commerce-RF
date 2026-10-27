import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useDevice } from '../lib/device';
import { brl, date, dateTime, parsePrice } from '../lib/format';
import type { Finance, Payout } from '../lib/types';
import { BarChart, Kpi, KpiSkel } from '../ui/charts';
import { Alert, Field, LoadError, Modal, StateBlock } from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { AdminShell, TableSkel } from './AdminShell';

type Configured = Extract<Finance, { configured: true }>;

const PAYOUT_STATUS: Record<Payout['status'], [string, string]> = {
  paid: ['b-success', 'Pago'],
  pending: ['b-warning', 'Em andamento'],
  failed: ['b-danger', 'Falhou'],
};

const MONTHS_AHEAD = 4;

/** Recebíveis somados por mês (o mês atual e os próximos), para o gráfico. */
function byMonth(receivables: Configured['receivables']) {
  const now = new Date();
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      total: 0,
    };
  });
  for (const r of receivables) {
    const d = new Date(r.availableOn);
    const month = months.find(
      (m) => m.key === `${d.getFullYear()}-${d.getMonth()}`,
    );
    if (month) month.total += r.amount;
  }
  return months;
}

function PayoutModal({
  available,
  onClose,
}: {
  available: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(available.toFixed(2).replace('.', ','));
  const [error, setError] = useState<string | undefined>();
  // uma chave por modal aberto: um clique duplo não repassa duas vezes
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const payout = useMutation({
    mutationFn: (amount: number) => api.requestPayout(amount, idempotencyKey),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
      if (result.status === 'failed')
        toast(
          'error',
          'O repasse não foi concluído',
          'O valor voltou para o saldo disponível.',
        );
      else
        toast('success', 'Repasse solicitado', `${brl(result.amount)} via Pix`);
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const submit = () => {
    const amount = parsePrice(value);
    if (amount === null || amount <= 0)
      return setError('Informe um valor, como 150,00.');
    if (amount > available) return setError(`O máximo é ${brl(available)}.`);
    setError(undefined);
    payout.mutate(amount);
  };

  return (
    <Modal label="Solicitar repasse" small onClose={onClose}>
      <form
        className="panel-b"
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2 className="h3">Solicitar repasse</h2>
        <Field
          id="payout-amount"
          label="Valor"
          inputMode="numeric"
          value={value}
          onChange={setValue}
          error={error}
          help={`Disponível: ${brl(available)}. O Pix cai na hora na chave cadastrada.`}
          disabled={payout.isPending}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn btn-primary${payout.isPending ? ' is-loading' : ''}`}
          >
            Repassar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PayoutKeyForm({ current }: { current: string | null }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(current ?? '');
  const [error, setError] = useState<string | undefined>();

  const save = useMutation({
    mutationFn: () => api.setPayoutKey(value),
    onSuccess: async (result) => {
      setValue(result.payoutPixKey);
      setError(undefined);
      await queryClient.invalidateQueries({ queryKey: ['finance'] });
      toast('success', 'Chave Pix salva', result.payoutPixKey);
    },
    onError: (e) => setError(e.message),
  });

  return (
    <form
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field
        id="payout-key"
        label="Chave Pix de repasse"
        placeholder="CPF, CNPJ, e-mail, +55 celular ou chave aleatória"
        value={value}
        onChange={setValue}
        error={error}
        disabled={save.isPending}
        className="grow"
      />
      <button
        type="submit"
        className={`btn btn-secondary${save.isPending ? ' is-loading' : ''}`}
        style={{ marginTop: 26 }}
        disabled={!value.trim() || value === current}
      >
        Salvar
      </button>
    </form>
  );
}

function FinanceBody({ data }: { data: Configured }) {
  const mobile = useDevice() === 'mobile';
  const [payoutOpen, setPayoutOpen] = useState(false);
  const next = data.receivables[0];
  const months = byMonth(data.receivables);
  const canPayout = data.available >= 1 && !!data.payoutPixKey;

  return (
    <>
      {data.available < 0 && (
        <Alert tone="warning" title="Saldo negativo">
          Estornos levaram mais do que o saldo disponível (a taxa do PSP não
          volta no estorno). Os próximos recebíveis cobrem a diferença antes de
          novos repasses.
        </Alert>
      )}

      <div className="kpis">
        <Kpi
          icon="download"
          label="Disponível para repasse"
          value={brl(data.available)}
          foot="pode ir para a conta da loja agora"
        />
        <Kpi
          icon="clock"
          label="A liberar"
          value={brl(data.pending)}
          foot={`${data.receivables.length} recebíveis na agenda`}
        />
        <Kpi
          icon="calendar"
          label="Próxima liberação"
          value={next ? brl(next.amount) : '—'}
          foot={next ? `em ${date(next.availableOn)}` : 'nada agendado'}
        />
      </div>

      <div className="charts2">
        <section className="panel chart-p">
          <div className="chart-h">
            <div>
              <h2 className="h4">Agenda de recebíveis</h2>
              <p className="faint">
                Pix entra no mesmo dia; cartão, 30 dias depois de cada parcela
              </p>
            </div>
            <strong className="price">{brl(data.pending)}</strong>
          </div>
          {data.receivables.length ? (
            <BarChart
              labels={months.map((m) => m.label)}
              values={months.map((m) => m.total)}
              label="Valor a liberar por mês"
              tip={(i) => `${months[i].label} · ${brl(months[i].total)}`}
            />
          ) : (
            <p className="muted">
              Nada a liberar: todo o saldo já está disponível.
            </p>
          )}
        </section>

        <section className="panel chart-p">
          <div className="chart-h">
            <div>
              <h2 className="h4">Repasses</h2>
              <p className="faint">
                Do saldo disponível para a chave Pix da loja
              </p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setPayoutOpen(true)}
              disabled={!canPayout}
              title={
                !data.payoutPixKey
                  ? 'Cadastre a chave Pix de repasse primeiro'
                  : undefined
              }
            >
              <Icon name="download" size={16} />
              Solicitar repasse
            </button>
          </div>
          <PayoutKeyForm current={data.payoutPixKey} />
        </section>
      </div>

      <div className="tables">
        <section className="panel">
          <div className="panel-h">
            <h2 className="h4">Próximas liberações</h2>
            <span className="faint small">
              {data.receivables.length} recebíveis
            </span>
          </div>
          {!data.receivables.length ? (
            <div className="panel-b muted">Nenhum recebível agendado.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Data</th>
                    {!mobile && <th>Origem</th>}
                    <th className="r">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.receivables.slice(0, 12).map((r) => (
                    <tr key={`${r.paymentId}-${r.installment}`}>
                      <td className="num">{date(r.availableOn)}</td>
                      {!mobile && (
                        <td>
                          <span className="mono small">{r.paymentId}</span>
                          <span className="faint small">
                            {' '}
                            · parcela {r.installment}
                          </span>
                        </td>
                      )}
                      <td className="r num">{brl(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-h">
            <h2 className="h4">Histórico de repasses</h2>
          </div>
          {!data.payouts.length ? (
            <div className="panel-b muted">Nenhum repasse ainda.</div>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Data</th>
                    {!mobile && <th>Chave</th>}
                    <th className="r">Valor</th>
                    <th className="r">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p) => {
                    const [tone, label] = PAYOUT_STATUS[p.status];
                    return (
                      <tr key={p.id}>
                        <td className="num">{dateTime(p.createdAt)}</td>
                        {!mobile && <td className="mono small">{p.pixKey}</td>}
                        <td className="r num">{brl(p.amount)}</td>
                        <td className="r">
                          <span className={`badge ${tone}`}>{label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {payoutOpen && (
        <PayoutModal
          available={data.available}
          onClose={() => setPayoutOpen(false)}
        />
      )}
    </>
  );
}

export function AdminFinancePage() {
  const finance = useQuery({ queryKey: ['finance'], queryFn: api.finance });

  let body;
  if (finance.isPending)
    body = (
      <>
        <div className="kpis" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <KpiSkel key={i} spark={false} />
          ))}
        </div>
        <TableSkel cols={3} rows={4} />
      </>
    );
  else if (finance.isError)
    body = (
      <LoadError
        what="o financeiro"
        code="GET /admin/finance"
        onRetry={() => finance.refetch()}
      />
    );
  else if (!finance.data.configured)
    body = (
      <StateBlock
        tone="brand"
        icon="server"
        code="Sem PSP"
        title="Financeiro indisponível"
        boxed
      >
        A loja não está ligada a um PSP, então os pagamentos são aprovados na
        hora sem passar dinheiro de verdade. Configure o PSP com{' '}
        <span className="mono">yarn psp:setup</span> para ver saldo, agenda de
        recebíveis e repasses.
      </StateBlock>
    );
  else body = <FinanceBody data={finance.data} />;

  return (
    <AdminShell crumb="Financeiro">
      <div className="dash-head">
        <div>
          <h1 className="h1">Financeiro</h1>
          <p className="muted">
            O dinheiro das vendas no PSP: o que já pode ir para a conta da loja,
            o que ainda vai entrar e os repasses feitos.
          </p>
        </div>
      </div>
      {body}
    </AdminShell>
  );
}
