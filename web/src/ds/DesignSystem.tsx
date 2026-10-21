import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { brl, stockInfo } from '../lib/format';
import { ROLE, type Product } from '../lib/types';
import { ProductCard, ProductCardSkel } from '../store/ProductPages';
import {
  Alert,
  Art,
  Field,
  Logo,
  RoleBadge,
  Skel,
  StateBlock,
  Stepper,
  ThemeButton,
} from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { ToastView } from '../ui/toast';

// Página de referência visual (só em desenvolvimento): todos os componentes nos seus
// estados e as cores lado a lado nos dois temas. Usa dados fixos, sem API.

const SAMPLE: Product[] = [
  {
    id: 1,
    name: 'Fone Bluetooth Aura',
    description: 'Cancelamento de ruído e 30 h de bateria.',
    price: '349.90',
    stock: 24,
  },
  {
    id: 2,
    name: 'Cafeteira Prensa Francesa 600 ml',
    description: 'Vidro borossilicato e filtro duplo de inox.',
    price: '129.90',
    stock: 3,
  },
  {
    id: 3,
    name: 'Luminária de Mesa Arco',
    description: 'LED regulável em 3 temperaturas de cor.',
    price: '219.00',
    stock: 0,
  },
  {
    id: 6,
    name: 'Teclado Mecânico TKL',
    description: 'Switches marrons, ABNT2 e luz branca.',
    price: '399.90',
    stock: 2,
  },
  {
    id: 8,
    name: 'Garrafa Térmica 750 ml',
    description: 'Gelado por 24 h e quente por 12 h.',
    price: '119.90',
    stock: 0,
  },
];
const [fone, cafeteira, luminaria, teclado, garrafa] = SAMPLE;

const TOKENS: [string, string][] = [
  ['bg-canvas', 'bg/canvas'],
  ['bg-surface', 'bg/surface'],
  ['bg-subtle', 'bg/subtle'],
  ['bg-muted', 'bg/muted'],
  ['brand', 'bg/brand'],
  ['brand-hover', 'bg/brand-hover'],
  ['brand-subtle', 'bg/brand-subtle'],
  ['success', 'bg/success'],
  ['success-subtle', 'bg/success-subtle'],
  ['warning-subtle', 'bg/warning-subtle'],
  ['danger', 'bg/danger'],
  ['danger-subtle', 'bg/danger-subtle'],
  ['info-subtle', 'bg/info-subtle'],
  ['text', 'text/primary'],
  ['text-2', 'text/secondary'],
  ['text-3', 'text/tertiary'],
  ['text-brand', 'text/brand'],
  ['text-success', 'text/success'],
  ['text-warning', 'text/warning'],
  ['text-danger', 'text/danger'],
  ['border', 'border/default'],
  ['border-strong', 'border/strong'],
  ['focus', 'border/focus'],
  ['c1', 'chart/1'],
  ['c2', 'chart/2'],
];

const TYPES: [string, string, string][] = [
  ['display', 'Display · 40/48 Bold', 'Achados para casa'],
  ['h1', 'Heading/H1 · 32/40 Bold', 'Meus carrinhos'],
  ['h2', 'Heading/H2 · 24/32 Semi Bold', 'Pagamento aprovado'],
  ['h3', 'Heading/H3 · 20/28 Semi Bold', 'Remover o carrinho?'],
  ['h4', 'Heading/H4 · 16/24 Semi Bold', 'Resumo do carrinho'],
  ['body-l', 'Body/Large · 16/24', 'Pague com Pix e tenha aprovação na hora.'],
  ['', 'Body/Medium · 14/20', 'Use pelo menos 6 caracteres.'],
  ['small', 'Body/Small · 12/16', '3 unidades disponíveis'],
  ['eyebrow', 'Overline · 11/16 Semi Bold', 'Catálogo'],
  ['price pd-price', 'Price/Large · 28/36 Bold', 'R$ 349,90'],
  ['mono', 'Mono · referências', 'PAG-9TQ4XR'],
];

const BTN_TYPES: [string, string][] = [
  ['btn-primary', 'Primário'],
  ['btn-secondary', 'Secundário'],
  ['btn-ghost', 'Fantasma'],
  ['btn-danger', 'Perigo'],
];
const BTN_STATES: [string, string][] = [
  ['', 'Default'],
  ['is-hover', 'Hover'],
  ['dis', 'Desabilitado'],
  ['is-loading', 'Carregando'],
];

function Section({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="doc-sec">
      <header>
        <h2 className="h2">{title}</h2>
        {sub && <p className="muted">{sub}</p>}
      </header>
      {children}
    </section>
  );
}

const Spec = ({
  label,
  children,
  style,
}: {
  label?: string;
  children: ReactNode;
  style?: CSSProperties;
}) => (
  <div className="panel spec" style={style}>
    {label && <span className="spec-l">{label}</span>}
    {children}
  </div>
);

function Spark({ values }: { values: number[] }) {
  const w = 112,
    h = 36,
    p = 3;
  const mx = Math.max(...values),
    mn = Math.min(...values),
    range = mx - mn || 1;
  const pts = values.map((v, i) => [
    p + (i * (w - 2 * p)) / Math.max(1, values.length - 1),
    h - p - ((v - mn) / range) * (h - 2 * p),
  ]);
  const d = pts
    .map((q, i) => `${i ? 'L' : 'M'}${q[0].toFixed(1)} ${q[1].toFixed(1)}`)
    .join('');
  const last = pts[pts.length - 1];
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden="true"
    >
      <path
        d={`${d}L${last[0].toFixed(1)} ${h}L${pts[0][0]} ${h}Z`}
        style={{ fill: 'var(--c1)', fillOpacity: 0.12 }}
      />
      <path
        d={d}
        style={{
          fill: 'none',
          stroke: 'var(--c1)',
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3}
        style={{
          fill: 'var(--c1)',
          stroke: 'var(--bg-surface)',
          strokeWidth: 2,
        }}
      />
    </svg>
  );
}

function Kpi({
  icon,
  label,
  value,
  delta,
  values,
}: {
  icon: IconName;
  label: string;
  value: string;
  delta: number;
  values: number[];
}) {
  const dir = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <div className="panel kpi">
      <div className="kpi-top">
        <Icon name={icon} size={16} />
        {label}
      </div>
      <div className="kpi-row">
        <span className="kpi-v">{value}</span>
        <Spark values={values} />
      </div>
      <div className="kpi-f">
        <span className={`delta ${dir}`}>
          <Icon
            name={dir === 'down' ? 'trending-down' : 'trending-up'}
            size={12}
          />
          {(delta > 0 ? '+' : '') +
            delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          %
        </span>
        vs. período anterior
      </div>
    </div>
  );
}

const KpiSkel = () => (
  <div className="panel kpi">
    <Skel w="50%" h={14} />
    <div className="kpi-row">
      <Skel w="60%" h={32} />
      <Skel w="112px" h={36} />
    </div>
    <Skel w="70%" h={14} />
  </div>
);

const TOASTS = [
  {
    type: 'success',
    title: 'Produto criado',
    msg: 'Fone Bluetooth Aura · R$ 349,90',
  },
  {
    type: 'error',
    title: 'Não foi possível salvar',
    msg: 'O servidor não respondeu. Tente de novo.',
  },
  { type: 'info', title: 'Referência copiada', msg: 'PAG-9TQ4XR' },
  {
    type: 'warning',
    title: 'Quantidade ajustada',
    msg: 'Só há 3 unidades disponíveis.',
  },
] as const;

export default function DesignSystem() {
  return (
    <>
      <header className="hdr">
        <div className="hdr-in">
          <Logo />
          <span style={{ flex: 1 }} />
          <span className="badge nodot b-warning">
            Somente em desenvolvimento
          </span>
          <ThemeButton />
        </div>
      </header>
      <div className="doc">
        <section className="doc-sec">
          <header>
            <p className="eyebrow">Design System</p>
            <h1 className="h1">Prateleira UI</h1>
            <p className="muted">
              Os mesmos tokens criados no Figma (Primitivos, Cor · Claro, Cor ·
              Escuro, Espaçamento, Raio e Tipografia). Todos os componentes
              abaixo são os que a loja usa. Troque o tema no botão do topo para
              ver esta página no modo escuro.
            </p>
          </header>
        </section>

        <Section
          title="Cores semânticas"
          sub="Componentes usam só tokens semânticos. Os dois temas apontam para os mesmos nomes."
        >
          <div className="themes">
            {(['light', 'dark'] as const).map((mode) => (
              <div className="theme-p app" data-mode={mode} key={mode}>
                <b>{mode === 'light' ? 'Cor · Claro' : 'Cor · Escuro'}</b>
                <div className="sw-list">
                  {TOKENS.map(([k, n]) => (
                    <div className="sw" key={k}>
                      <i style={{ background: `var(--${k})` }} />
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Tipografia"
          sub="Inter para interface, IBM Plex Mono para referências e IDs. Números em tabelas usam algarismos tabulares."
        >
          <div className="panel panel-b">
            {TYPES.map(([cls, label, text]) => (
              <div className="type-row" key={label}>
                <span className="small faint">{label}</span>
                <span className={cls}>{text}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Espaçamento e raio">
          <div className="doc-grid">
            <Spec label="space/*">
              {[
                [1, 4],
                [2, 8],
                [3, 12],
                [4, 16],
                [6, 24],
                [8, 32],
                [12, 48],
                [16, 64],
              ].map(([k, v]) => (
                <div className="space-row" key={k}>
                  <span className="mono" style={{ width: 70 }}>
                    space/{k}
                  </span>
                  <i style={{ width: v }} />
                  <span className="faint">{v}px</span>
                </div>
              ))}
            </Spec>
            <Spec label="radius/*">
              {(
                [
                  ['sm', 6],
                  ['md', 10],
                  ['lg', 14],
                  ['xl', 20],
                  ['full', 999],
                ] as const
              ).map(([k, v]) => (
                <div className="space-row" key={k}>
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      border: '2px solid var(--brand)',
                      borderRadius: Math.min(v, 18),
                      display: 'block',
                    }}
                  />
                  <span className="mono">radius/{k}</span>
                  <span className="faint">
                    {v === 999 ? '999 (pílula)' : `${v}px`}
                  </span>
                </div>
              ))}
            </Spec>
            <Spec label="Sombras">
              {['sm', 'md', 'lg'].map((k) => (
                <div
                  key={k}
                  className="small"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    background: 'var(--bg-surface)',
                    boxShadow: `var(--sh-${k})`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  Sombra/{k}
                </div>
              ))}
            </Spec>
          </div>
        </Section>

        <Section
          title="Botões"
          sub="Tipo × estado. Altura 44 (padrão), 36 (sm) e 52 (lg). O estado de carregamento mantém a largura e bloqueia cliques repetidos."
        >
          <div className="panel matrix">
            <table>
              <thead>
                <tr>
                  <th />
                  {BTN_STATES.map(([, l]) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BTN_TYPES.map(([cls, label]) => (
                  <tr key={cls}>
                    <th>{label}</th>
                    {BTN_STATES.map(([state]) => (
                      <td key={state}>
                        <button
                          className={`btn ${cls} ${state === 'dis' ? '' : state}`}
                          disabled={state === 'dis'}
                        >
                          {cls === 'btn-danger' ? 'Remover' : 'Adicionar'}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="doc-grid">
            <Spec label="Tamanhos">
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <button className="btn btn-primary btn-sm">Pequeno</button>
                <button className="btn btn-primary">Médio</button>
                <button className="btn btn-primary btn-lg">Grande</button>
              </div>
            </Spec>
            <Spec label="Botão de ícone">
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="icon-btn" aria-label="Editar">
                  <Icon name="pencil" size={18} />
                </button>
                <button className="icon-btn is-hover" aria-label="Editar">
                  <Icon name="pencil" size={18} />
                </button>
                <button className="icon-btn danger" aria-label="Remover">
                  <Icon name="trash" size={18} />
                </button>
                <button className="icon-btn" disabled aria-label="Remover">
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </Spec>
            <Spec label="Seletor segmentado">
              <div className="seg">
                <button aria-pressed="false">Hoje</button>
                <button aria-pressed="true">7 dias</button>
                <button aria-pressed="false">30 dias</button>
              </div>
            </Spec>
          </div>
        </Section>

        <Section
          title="Campos"
          sub="Label sempre visível, ajuda abaixo e mensagem de erro com ícone, nunca só a cor."
        >
          <div className="doc-grid">
            <Spec label="Default">
              <Field
                id="ds1"
                label="E-mail"
                icon="mail"
                placeholder="voce@email.com"
                value=""
              />
            </Spec>
            <Spec label="Hover">
              <Field
                id="ds2"
                label="E-mail"
                icon="mail"
                placeholder="voce@email.com"
                value=""
                className="is-hover"
              />
            </Spec>
            <Spec label="Foco">
              <Field
                id="ds3"
                label="E-mail"
                icon="mail"
                value="marcos@"
                className="is-focus"
              />
            </Spec>
            <Spec label="Preenchido">
              <Field
                id="ds4"
                label="Nome"
                value="Marcos"
                help="Como aparece no seu perfil."
              />
            </Spec>
            <Spec label="Erro">
              <Field
                id="ds5"
                label="Senha"
                type="password"
                icon="lock"
                value="abc"
                error="A senha precisa ter pelo menos 6 caracteres."
              />
            </Spec>
            <Spec label="Desabilitado">
              <Field
                id="ds6"
                label="E-mail"
                icon="mail"
                value="cliente@prateleira.com"
                disabled
              />
            </Spec>
            <Spec label="Carregando">
              <Field
                id="ds7"
                label="E-mail"
                icon="mail"
                value="julia.rocha@email.com"
                help="Verificando disponibilidade…"
                right={<span className="spin ctl-spin" aria-hidden="true" />}
              />
            </Spec>
            <Spec label="Quantidade">
              <Stepper value={2} max={5} />
              <Stepper value={5} max={5} />
              <Stepper value={8} max={5} error />
              <Stepper value={1} max={1} disabled />
            </Spec>
          </div>
        </Section>

        <Section
          title="Badges"
          sub="Sempre com texto. O ponto reforça o status, a cor nunca está sozinha."
        >
          <div className="doc-grid">
            <Spec label="Estoque">
              {[fone, cafeteira, luminaria].map((p) => {
                const s = stockInfo(p);
                return (
                  <span key={p.id} className={`badge b-${s.cls}`}>
                    {s.label}
                  </span>
                );
              })}
            </Spec>
            <Spec label="Pedido">
              <span className="badge b-success">Pago</span>
              <span className="badge b-info">Processando</span>
            </Spec>
            <Spec label="Papel">
              <RoleBadge role={ROLE.ADMIN} />
              <RoleBadge role={ROLE.MODERATOR} />
              <RoleBadge role={ROLE.USER} />
            </Spec>
          </div>
        </Section>

        <Section title="Card de produto">
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
            }}
          >
            <div className="spec">
              <span className="spec-l">Default</span>
              <ProductCard product={fone} preview />
            </div>
            <div className="spec">
              <span className="spec-l">Hover</span>
              <ProductCard product={fone} hover preview />
            </div>
            <div className="spec">
              <span className="spec-l">Últimas unidades</span>
              <ProductCard product={teclado} preview />
            </div>
            <div className="spec">
              <span className="spec-l">Esgotado</span>
              <ProductCard product={garrafa} preview />
            </div>
            <div className="spec">
              <span className="spec-l">Carregando</span>
              <ProductCardSkel />
            </div>
          </div>
        </Section>

        <Section title="Feedback">
          <div
            className="doc-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))',
            }}
          >
            <div className="spec">
              <Alert tone="danger" title="E-mail ou senha incorretos">
                Confira os dados e tente de novo.
              </Alert>
            </div>
            <div className="spec">
              <Alert tone="warning" title="Estoque insuficiente">
                Ajuste a quantidade e tente de novo.
              </Alert>
            </div>
            <div className="spec">
              <Alert tone="info" title="Estoque reservado no pagamento">
                As quantidades são conferidas quando você paga.
              </Alert>
            </div>
            <div className="spec">
              <Alert tone="success" title="Alterações salvas">
                O produto já aparece atualizado na vitrine.
              </Alert>
            </div>
            {TOASTS.map((t) => (
              <div className="spec" key={t.type}>
                <ToastView toast={t} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Estados de tela">
          <div
            className="doc-grid"
            style={{
              gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))',
            }}
          >
            <StateBlock icon="search-x" title="Nenhum produto encontrado" boxed>
              Tente um termo mais curto.
            </StateBlock>
            <StateBlock
              tone="danger"
              icon="server"
              code="500"
              title="Algo deu errado"
              boxed
              actions={
                <button className="btn btn-primary btn-sm">
                  <Icon name="refresh" size={16} />
                  Tentar novamente
                </button>
              }
            >
              Tente novamente.
            </StateBlock>
            <StateBlock
              tone="danger"
              icon="shield-x"
              code="403"
              title="Acesso negado"
              boxed
            >
              Você não tem permissão.
            </StateBlock>
            <StateBlock
              tone="warning"
              icon="search-x"
              code="404"
              title="Não encontrado"
              boxed
            >
              O item não existe ou foi removido.
            </StateBlock>
          </div>
        </Section>

        <Section title="Tabela, modal, navegação e KPI">
          <div className="tables">
            <div className="panel tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="r">Preço</th>
                    <th className="r">Estoque</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {[fone, cafeteira, luminaria].map((p) => {
                    const s = stockInfo(p);
                    return (
                      <tr key={p.id}>
                        <td>
                          <div className="c-prod">
                            <Art productId={p.id} size={18} className="thumb" />
                            <b>{p.name}</b>
                          </div>
                        </td>
                        <td className="r num">{brl(p.price)}</td>
                        <td className="r num">{p.stock}</td>
                        <td>
                          <span className={`badge b-${s.cls}`}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal sm" style={{ margin: 0 }}>
              <div className="m-head">
                <div className="m-ic danger">
                  <Icon name="trash" size={22} />
                </div>
                <div className="grow">
                  <h3 className="h3">Remover o carrinho #1042?</h3>
                  <p className="muted">Os 2 itens serão descartados.</p>
                </div>
              </div>
              <div className="m-foot" style={{ border: 0 }}>
                <button className="btn btn-secondary">Cancelar</button>
                <button className="btn btn-danger">Remover carrinho</button>
              </div>
            </div>
            <Spec label="Item da sidebar">
              <button className="nav-i">
                <Icon name="dashboard" size={18} />
                Default
              </button>
              <button className="nav-i is-hover">
                <Icon name="package" size={18} />
                Hover
              </button>
              <button className="nav-i on">
                <Icon name="users" size={18} />
                Ativo<span className="cnt">8</span>
              </button>
            </Spec>
            <Spec label="Forma de pagamento">
              <div className="rcards">
                <div className="rcard" aria-checked="true">
                  <span className="radio" />
                  <span className="rc-ic">
                    <Icon name="pix" size={20} />
                  </span>
                  <span>
                    <span className="rc-t">Pix</span>
                    <br />
                    <span className="rc-d">Selecionado</span>
                  </span>
                </div>
                <div className="rcard" aria-checked="false">
                  <span className="radio" />
                  <span className="rc-ic">
                    <Icon name="card" size={20} />
                  </span>
                  <span>
                    <span className="rc-t">Cartão de crédito</span>
                    <br />
                    <span className="rc-d">Default</span>
                  </span>
                </div>
              </div>
            </Spec>
            <div className="spec">
              <Kpi
                icon="receipt"
                label="Receita total"
                value="R$ 32.418,50"
                delta={12.4}
                values={[3, 4, 3.5, 5, 4.6, 5.8, 6.2]}
              />
            </div>
            <div className="spec">
              <KpiSkel />
            </div>
          </div>
        </Section>

        <p className="faint small">
          Voltar para a <Link to="/produtos">loja</Link>.
        </p>
      </div>
    </>
  );
}
