import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useDevice } from '../lib/device';
import { fullName, initials } from '../lib/format';
import { Field, Logo, ThemeButton } from '../ui/components';
import { Icon } from '../ui/Icon';
import { itemCount, useCarts } from './queries';

export function UserMenu({ compact }: { compact?: boolean }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const close = () => setOpen(false);

  return (
    <div className="menu-wrap" ref={ref}>
      {compact ? (
        <button
          className="icon-btn"
          onClick={() => setOpen(!open)}
          aria-label="Menu da conta"
          aria-expanded={open}
        >
          <span className="avatar">{initials(user)}</span>
        </button>
      ) : (
        <button
          className="user-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <span className="avatar">{initials(user)}</span>
          <span className="un">{user.firstName ?? user.email}</span>
          <Icon name="chevron-down" size={16} />
        </button>
      )}
      {open && (
        <div className="menu" role="menu">
          <div className="menu-h">
            <b>{fullName(user)}</b>
            <span className="faint small">{user.email}</span>
          </div>
          <Link className="menu-i" to="/perfil" role="menuitem" onClick={close}>
            <Icon name="user" size={18} />
            Perfil
          </Link>
          {isAdmin && (
            <Link
              className="menu-i"
              to="/admin/produtos"
              role="menuitem"
              onClick={close}
            >
              <Icon name="dashboard" size={18} />
              Admin
            </Link>
          )}
          <Link
            className="menu-i"
            to="/carrinhos"
            role="menuitem"
            onClick={close}
          >
            <Icon name="cart" size={18} />
            Meus carrinhos
          </Link>
          <hr className="divider" style={{ margin: '6px 0' }} />
          <button className="menu-i danger" role="menuitem" onClick={logout}>
            <Icon name="log-out" size={18} />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

/** Busca do catálogo: o termo mora na URL (/produtos?busca=…). */
function SearchForm({ id, placeholder }: { id: string; placeholder: string }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState(params.get('busca') ?? '');
  useEffect(() => setQ(params.get('busca') ?? ''), [params]);

  const go = (value: string) =>
    navigate(
      value ? `/produtos?busca=${encodeURIComponent(value)}` : '/produtos',
      {
        replace: pathname === '/produtos',
      },
    );

  return (
    <form
      className="hdr-search"
      role="search"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        go(q.trim());
      }}
    >
      <Field
        id={id}
        label={<span className="sr">Buscar produtos</span>}
        icon="search"
        placeholder={placeholder}
        value={q}
        onChange={(v) => {
          setQ(v);
          if (pathname === '/produtos') go(v);
        }}
      />
    </form>
  );
}

export function Header() {
  const { user } = useAuth();
  const mobile = useDevice() === 'mobile';
  const { pathname } = useLocation();
  const carts = useCarts(!!user);
  const [searchOpen, setSearchOpen] = useState(false);

  if (!user)
    return (
      <header className="hdr">
        <div className="hdr-in">
          <Logo to="/entrar" />
          <span style={{ flex: 1 }} />
          <ThemeButton />
          {pathname !== '/entrar' && (
            <Link className="btn btn-ghost btn-sm" to="/entrar">
              Entrar
            </Link>
          )}
          {pathname !== '/cadastro' && (
            <Link className="btn btn-primary btn-sm" to="/cadastro">
              Criar conta
            </Link>
          )}
        </div>
      </header>
    );

  const n = itemCount(carts.data);
  const cart = (
    <Link
      className="icon-btn cart-btn"
      to="/carrinhos"
      aria-label={`Carrinhos, ${n} itens`}
    >
      <Icon name="cart" size={22} />
      {n > 0 && <span className="count">{n}</span>}
    </Link>
  );

  if (mobile)
    return (
      <header className="hdr">
        <div className="hdr-in">
          <Logo />
          <span style={{ flex: 1 }} />
          <button
            className="icon-btn"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Buscar"
            aria-expanded={searchOpen}
          >
            <Icon name="search" size={22} />
          </button>
          {cart}
          <ThemeButton />
          <UserMenu compact />
        </div>
        {searchOpen && (
          <div className="m-search">
            <SearchForm id="busca-m" placeholder="Buscar produtos" />
          </div>
        )}
      </header>
    );

  return (
    <header className="hdr">
      <div className="hdr-in">
        <Logo />
        <SearchForm
          id="busca"
          placeholder="Buscar produtos, ex.: fone, caneca, mochila"
        />
        <nav className="hdr-nav" aria-label="Principal">
          <Link
            className={`nav-link ${pathname.startsWith('/produtos') ? 'on' : ''}`}
            to="/produtos"
          >
            Produtos
          </Link>
          {cart}
          <ThemeButton />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
