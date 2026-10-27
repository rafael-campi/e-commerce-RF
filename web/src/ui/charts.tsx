import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { Skel } from './components';

// Gráficos do protótipo em SVG puro. Cores só por token (--c1, --c2, --success…),
// então seguem o tema. A dica de cada ponto/barra é um <title> (tooltip nativo).

const int = (v: number) => Math.round(v).toLocaleString('pt-BR');
const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyShort = (v: number) =>
  v >= 1000
    ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
    : `R$ ${Math.round(v)}`;

/** Passo "redondo" para os eixos (1, 2, 2,5, 5 × 10ⁿ). */
function niceStep(x: number) {
  const e = 10 ** Math.floor(Math.log10(x || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * e >= x) return m * e;
  return 10 * e;
}

export function Spark({
  values,
  color = 'var(--c1)',
}: {
  values: number[];
  color?: string;
}) {
  const w = 112;
  const h = 36;
  const p = 3;
  const mx = Math.max(...values);
  const mn = Math.min(...values);
  const range = mx - mn || 1;
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
        style={{ fill: color, fillOpacity: 0.12 }}
      />
      <path
        d={d}
        style={{
          fill: 'none',
          stroke: color,
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        }}
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3}
        style={{ fill: color, stroke: 'var(--bg-surface)', strokeWidth: 2 }}
      />
    </svg>
  );
}

/** Variação percentual contra o período anterior; null quando não há base de comparação. */
export const deltaPct = (current: number, previous: number) =>
  previous ? ((current - previous) / previous) * 100 : null;

export function Kpi({
  icon,
  label,
  value,
  delta,
  good = true,
  foot,
  values,
}: {
  icon: IconName;
  label: string;
  value: string;
  delta?: number | null;
  /** subir é bom? (para "carrinhos abertos", não é) */
  good?: boolean;
  foot?: ReactNode;
  values?: number[];
}) {
  const dir =
    delta == null
      ? null
      : delta > 0.05
        ? 'up'
        : delta < -0.05
          ? 'down'
          : 'flat';
  const tone =
    dir === null || dir === 'flat'
      ? 'flat'
      : (dir === 'up') === good
        ? 'up'
        : 'down';
  return (
    <div className="panel kpi">
      <div className="kpi-top">
        <Icon name={icon} size={16} />
        {label}
      </div>
      <div className="kpi-row">
        <span className="kpi-v">{value}</span>
        {values && values.length > 1 && <Spark values={values} />}
      </div>
      <div className="kpi-f">
        {delta != null && (
          <span className={`delta ${tone}`}>
            <Icon
              name={dir === 'down' ? 'trending-down' : 'trending-up'}
              size={12}
            />
            {(delta > 0 ? '+' : '') +
              delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            %
          </span>
        )}
        {foot ??
          (delta == null
            ? 'sem vendas no período anterior para comparar'
            : 'vs. período anterior')}
      </div>
    </div>
  );
}

export const KpiSkel = ({ spark = true }: { spark?: boolean }) => (
  <div className="panel kpi">
    <Skel w="50%" h={14} />
    <div className="kpi-row">
      <Skel w="60%" h={32} />
      {spark && <Skel w="112px" h={36} />}
    </div>
    <Skel w="70%" h={14} />
  </div>
);

export function LineChart({
  labels,
  values,
  tip,
  label,
}: {
  labels: string[];
  values: number[];
  tip: (i: number) => string;
  label: string;
}) {
  const W = 720;
  const H = 250;
  const L = 64;
  const R = 20;
  const T = 18;
  const B = 30;
  const step = niceStep(Math.max(...values, 1) / 4);
  const max = step * 4;
  const n = values.length;
  const x = (i: number) => L + (n === 1 ? 0 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const d = values
    .map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join('');
  const every = Math.ceil(n / 8);
  const colW = (W - L - R) / Math.max(1, n - 1);
  const lx = x(n - 1);
  const ly = y(values[n - 1]);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0"
              style={{ stopColor: 'var(--c1)', stopOpacity: 0.22 }}
            />
            <stop
              offset="1"
              style={{ stopColor: 'var(--c1)', stopOpacity: 0 }}
            />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line
              className={k ? 'gl' : 'base'}
              x1={L}
              x2={W - R}
              y1={y(step * k)}
              y2={y(step * k)}
            />
            <text x={L - 10} y={y(step * k) + 4} textAnchor="end">
              {moneyShort(step * k)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          (i % every === 0 && n - 1 - i >= every * 0.6) || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
        <path
          d={`${d}L${x(n - 1)} ${y(0)}L${x(0)} ${y(0)}Z`}
          style={{ fill: 'url(#rev-fill)' }}
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
          cx={lx}
          cy={ly}
          r={4.5}
          style={{
            fill: 'var(--c1)',
            stroke: 'var(--bg-surface)',
            strokeWidth: 2,
          }}
        />
        <text className="lbl" x={lx - 8} y={ly - 12} textAnchor="end">
          {brl(values[n - 1])}
        </text>
        {values.map((v, i) => (
          <g className="pt" key={i}>
            <line className="xh" x1={x(i)} x2={x(i)} y1={T} y2={H - B} />
            <circle
              className="pd"
              cx={x(i)}
              cy={y(v)}
              r={5}
              style={{
                fill: 'var(--c1)',
                stroke: 'var(--bg-surface)',
                strokeWidth: 2,
              }}
            />
            <rect
              x={x(i) - colW / 2}
              y={T}
              width={colW}
              height={H - T - B}
              style={{ fill: 'transparent' }}
            >
              <title>{tip(i)}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function BarChart({
  labels,
  values,
  color = 'var(--c1)',
  tip,
  label,
}: {
  labels: string[];
  values: number[];
  color?: string;
  tip: (i: number) => string;
  label: string;
}) {
  const W = 520;
  const H = 220;
  const L = 40;
  const R = 8;
  const T = 20;
  const B = 30;
  const step = Math.max(1, Math.ceil(niceStep(Math.max(...values, 1) / 4)));
  const max = step * 4;
  const n = values.length;
  const slot = (W - L - R) / n;
  const bw = Math.min(56, slot * 0.62);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const every = Math.ceil(n / 10);
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line
              className={k ? 'gl' : 'base'}
              x1={L}
              x2={W - R}
              y1={y(step * k)}
              y2={y(step * k)}
            />
            <text x={L - 8} y={y(step * k) + 4} textAnchor="end">
              {int(step * k)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = L + slot * i + slot / 2;
          const top = y(v);
          const hh = Math.max(0, y(0) - top);
          const r = Math.min(4, hh / 2);
          const path =
            hh > 0
              ? `M${cx - bw / 2} ${y(0)}V${top + r}Q${cx - bw / 2} ${top} ${cx - bw / 2 + r} ${top}H${cx + bw / 2 - r}Q${cx + bw / 2} ${top} ${cx + bw / 2} ${top + r}V${y(0)}Z`
              : '';
          return (
            <g key={i}>
              <path className="bar" d={path} style={{ fill: color }} />
              <rect
                x={cx - slot / 2}
                y={T}
                width={slot}
                height={H - T - B}
                style={{ fill: 'transparent' }}
              >
                <title>{tip(i)}</title>
              </rect>
              {n <= 8 && v > 0 && (
                <text className="lbl" x={cx} y={top - 6} textAnchor="middle">
                  {int(v)}
                </text>
              )}
              {i % every === 0 && (
                <text x={cx} y={H - 8} textAnchor="middle">
                  {labels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Donut({
  a,
  b,
  labelA,
  labelB,
}: {
  a: number;
  b: number;
  labelA: string;
  labelB: string;
}) {
  const total = a + b || 1;
  const R = 62;
  const C = 2 * Math.PI * R;
  const gap = a && b ? 3 : 0;
  const la = (C * a) / total;
  const lb = (C * b) / total;
  const pct = (v: number) => Math.round((v / total) * 100);
  return (
    <svg
      viewBox="0 0 160 160"
      role="img"
      aria-label={`${labelA} ${pct(a)}%, ${labelB} ${pct(b)}%`}
    >
      <g transform="rotate(-90 80 80)">
        <circle
          cx="80"
          cy="80"
          r={R}
          style={{ fill: 'none', stroke: 'var(--bg-subtle)', strokeWidth: 22 }}
        />
        {a > 0 && (
          <circle
            cx="80"
            cy="80"
            r={R}
            style={{ fill: 'none', stroke: 'var(--c1)', strokeWidth: 22 }}
            strokeDasharray={`${Math.max(0, la - gap)} ${C}`}
          >
            <title>{`${labelA} · ${int(a)} pedidos (${pct(a)}%)`}</title>
          </circle>
        )}
        {b > 0 && (
          <circle
            cx="80"
            cy="80"
            r={R}
            style={{ fill: 'none', stroke: 'var(--c2)', strokeWidth: 22 }}
            strokeDasharray={`${Math.max(0, lb - gap)} ${C}`}
            strokeDashoffset={-la}
          >
            <title>{`${labelB} · ${int(b)} pedidos (${pct(b)}%)`}</title>
          </circle>
        )}
      </g>
      <text
        x="80"
        y="78"
        textAnchor="middle"
        style={{
          fill: 'var(--text)',
          fontSize: 24,
          fontWeight: 700,
          fontFamily: 'var(--font)',
        }}
      >
        {int(a + b)}
      </text>
      <text
        x="80"
        y="98"
        textAnchor="middle"
        style={{
          fill: 'var(--text-3)',
          fontSize: 11,
          fontFamily: 'var(--font)',
        }}
      >
        pedidos pagos
      </text>
    </svg>
  );
}
