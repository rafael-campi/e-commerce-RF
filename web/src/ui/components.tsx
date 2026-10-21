import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { artFor, roleName } from '../lib/format';
import { useTheme } from '../lib/theme';
import type { RoleId } from '../lib/types';

export function Field({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  help,
  error,
  disabled,
  icon,
  right,
  autoComplete = 'off',
  area,
  className = '',
}: {
  id: string;
  label: ReactNode;
  type?: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  help?: ReactNode;
  error?: string;
  disabled?: boolean;
  icon?: IconName;
  right?: ReactNode;
  autoComplete?: string;
  area?: boolean;
  className?: string;
}) {
  const common = {
    id,
    name: id,
    value,
    placeholder,
    disabled,
    'aria-invalid': !!error,
    'aria-describedby': error || help ? `${id}-help` : undefined,
    onChange: (e: { target: { value: string } }) => onChange?.(e.target.value),
    readOnly: !onChange,
  };
  return (
    <div className={`field ${error ? 'is-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="ctl">
        {icon && <Icon name={icon} size={18} className="ctl-ic" />}
        {area ? (
          <textarea {...common} />
        ) : (
          <input {...common} type={type} autoComplete={autoComplete} />
        )}
        {right}
      </div>
      {error ? (
        <p className="help err" id={`${id}-help`}>
          <Icon name="alert-circle" size={14} />
          <span>{error}</span>
        </p>
      ) : help ? (
        <p className="help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordToggle({
  shown,
  onToggle,
}: {
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-btn sm ctl-r"
      onClick={onToggle}
      aria-label={`${shown ? 'Ocultar' : 'Mostrar'} senha`}
    >
      <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
    </button>
  );
}

type Tone = 'danger' | 'warning' | 'info' | 'success';
const alertIcon: Record<Tone, IconName> = {
  danger: 'alert-circle',
  warning: 'alert-triangle',
  success: 'check-circle',
  info: 'info',
};

export function Alert({
  tone,
  title,
  children,
  actions,
  small,
}: {
  tone: Tone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  small?: boolean;
}) {
  return (
    <div
      className={`alert a-${tone}${small ? ' sm' : ''}`}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <Icon name={alertIcon[tone]} size={18} />
      <div className="a-body">
        {title && <b>{title}</b>}
        {children && <span>{children}</span>}
        {actions && <div className="a-act">{actions}</div>}
      </div>
    </div>
  );
}

export function StateBlock({
  tone = 'neutral',
  icon = 'inbox',
  title,
  children,
  code,
  actions,
  boxed,
}: {
  tone?: 'neutral' | 'danger' | 'warning' | 'brand';
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  code?: string;
  actions?: ReactNode;
  boxed?: boolean;
}) {
  return (
    <div className={`state s-${tone}${boxed ? ' boxed' : ''}`}>
      <div className="s-ic">
        <Icon name={icon} size={28} />
      </div>
      {code && <span className="s-code">{code}</span>}
      <h2 className="h3">{title}</h2>
      {children && <p className="muted">{children}</p>}
      {actions && <div className="s-act">{actions}</div>}
    </div>
  );
}

/** Bloco de erro de carregamento com "Tentar novamente". */
export function LoadError({
  what,
  code,
  onRetry,
}: {
  what: string;
  code: string;
  onRetry: () => void;
}) {
  return (
    <StateBlock
      tone="danger"
      icon="server"
      code={code}
      title={`Não conseguimos carregar ${what}`}
      boxed
      actions={
        <button className="btn btn-primary" onClick={onRetry}>
          <Icon name="refresh" size={18} />
          Tentar novamente
        </button>
      }
    >
      Houve uma falha ao falar com o servidor. Tente novamente em alguns
      segundos.
    </StateBlock>
  );
}

/**
 * Seletor de quantidade. Os botões mudam na hora; o número digitado vale ao sair do
 * campo ou apertar Enter (onCommit), para não disparar a cada tecla.
 */
export function Stepper({
  value,
  max,
  onChange,
  onCommit = onChange,
  disabled,
  error,
  label = 'Quantidade',
}: {
  value: number;
  max: number;
  onChange?: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  error?: boolean;
  label?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const commit = () => {
    const n = Number.parseInt(text, 10);
    // volta ao valor atual; se o pai aceitar o novo número, o efeito acima atualiza
    setText(String(value));
    if (!Number.isNaN(n) && n >= 1 && n !== value) onCommit?.(n);
  };

  return (
    <div
      className={`stepper${disabled ? ' is-disabled' : ''}${error ? ' is-error' : ''}`}
    >
      <button
        type="button"
        disabled={value <= 1 || disabled}
        aria-label="Diminuir quantidade"
        onClick={() => onChange?.(value - 1)}
      >
        <Icon name="minus" size={16} />
      </button>
      <input
        inputMode="numeric"
        value={text}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
      <button
        type="button"
        disabled={value >= max || disabled}
        aria-label="Aumentar quantidade"
        onClick={() => onChange?.(value + 1)}
      >
        <Icon name="plus" size={16} />
      </button>
    </div>
  );
}

export const Skel = ({ w, h, r }: { w: string; h: number; r?: number }) => (
  <div className="skel" style={{ width: w, height: h, borderRadius: r }} />
);

export function Art({
  productId,
  size,
  className = '',
  style,
}: {
  productId: number;
  size: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { icon, tone } = artFor(productId);
  return (
    <div
      className={`art ${className}`}
      style={{ '--tone': tone, ...style } as CSSProperties}
    >
      <Icon name={icon} size={size} />
    </div>
  );
}

export function RoleBadge({ role }: { role: RoleId }) {
  const name = roleName(role);
  const cls =
    name === 'ADMIN'
      ? 'b-brand'
      : name === 'MODERATOR'
        ? 'b-info'
        : 'b-neutral';
  return <span className={`badge nodot ${cls}`}>{name}</span>;
}

export function Logo({ to = '/produtos' }: { to?: string }) {
  return (
    <Link className="logo" to={to} aria-label="Prateleira, início">
      <span className="logo-mark">
        <Icon name="shelf" size={18} />
      </span>
      Prateleira
    </Link>
  );
}

const themeLabel = {
  system: 'Tema do sistema',
  light: 'Tema claro',
  dark: 'Tema escuro',
};
const themeIcon: Record<keyof typeof themeLabel, IconName> = {
  system: 'monitor',
  light: 'sun',
  dark: 'moon',
};

export function ThemeButton() {
  const { theme, next } = useTheme();
  return (
    <button
      type="button"
      className="icon-btn theme-btn"
      onClick={next}
      aria-label={`${themeLabel[theme]} (clique para trocar)`}
      title={themeLabel[theme]}
    >
      <Icon name={themeIcon[theme]} size={20} />
    </button>
  );
}

/** Modal centralizado (no celular, folha que sobe de baixo). Fecha com Esc e clique fora. */
export function Modal({
  onClose,
  small,
  label,
  children,
}: {
  onClose?: () => void;
  small?: boolean;
  label: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        className={`modal${small ? ' sm' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        {children}
      </div>
    </div>
  );
}

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <div className="checkout-steps" aria-label="Etapas">
      {['Carrinho', 'Pagamento', 'Confirmação'].map((t, i) => (
        <span key={t} style={{ display: 'contents' }}>
          {i > 0 && <span className="sep" />}
          <span
            className={`cs ${i < current ? 'done' : i === current ? 'now' : ''}`}
          >
            <i>{i < current ? <Icon name="check" size={12} /> : i + 1}</i>
            {t}
          </span>
        </span>
      ))}
    </div>
  );
}
