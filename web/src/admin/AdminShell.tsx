import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDevice } from '../lib/device';
import { Logo, Skel, ThemeButton } from '../ui/components';
import { Icon, type IconName } from '../ui/Icon';
import { UserMenu } from '../store/Header';
import { useProducts } from '../store/queries';

export const useUsers = () =>
  useQuery({ queryKey: ['users'], queryFn: api.users });
export const useOrders = () =>
  useQuery({ queryKey: ['orders'], queryFn: api.orders });

function Sidebar() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const counts: Record<string, number | undefined> = {
    '/admin/produtos': useProducts().data?.length,
    '/admin/usuarios': useUsers().data?.length,
    '/admin/pedidos': useOrders().data?.length,
  };
  const items: [string, IconName, string][] = [
    ['/admin', 'dashboard', 'Dashboard'],
    ['/admin/produtos', 'package', 'Produtos'],
    ['/admin/usuarios', 'users', 'Usuários'],
    ['/admin/pedidos', 'receipt', 'Pedidos'],
    ['/admin/financeiro', 'trending-up', 'Financeiro'],
  ];

  return (
    <nav className="sidebar" aria-label="Admin">
      <div style={{ padding: '4px 6px 12px' }}>
        <Logo to="/admin" />
      </div>
      <span className="sb-sec">Admin</span>
      {items.map(([to, icon, label]) => {
        const on = pathname === to;
        return (
          <Link
            key={to}
            className={`nav-i ${on ? 'on' : ''}`}
            to={to}
            aria-current={on ? 'page' : undefined}
          >
            <Icon name={icon} size={18} />
            {label}
            {counts[to] !== undefined && (
              <span className="cnt">{counts[to]}</span>
            )}
          </Link>
        );
      })}
      <div className="sb-foot">
        <Link className="nav-i" to="/produtos">
          <Icon name="store" size={18} />
          Ver loja
        </Link>
        <button className="nav-i" onClick={logout}>
          <Icon name="log-out" size={18} />
          Sair
        </button>
      </div>
    </nav>
  );
}

export function AdminShell({
  crumb,
  children,
}: {
  crumb: string;
  children: ReactNode;
}) {
  const mobile = useDevice() === 'mobile';
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);

  return (
    <div className="ad">
      <Sidebar />
      <div className="ad-main" style={{ minWidth: 0 }}>
        <div className="ad-top">
          {mobile ? (
            <>
              <button
                className="icon-btn"
                onClick={() => setNavOpen(true)}
                aria-label="Abrir menu"
              >
                <Icon name="menu" size={22} />
              </button>
              <Logo to="/admin" />
            </>
          ) : (
            <div className="crumbs">
              <span>Admin</span>
              <Icon name="chevron-right" size={14} />
              <b style={{ color: 'var(--text)' }}>{crumb}</b>
            </div>
          )}
          <span style={{ flex: 1 }} />
          {!mobile && (
            <Link className="btn btn-ghost btn-sm" to="/produtos">
              <Icon name="store" size={16} />
              Ver loja
            </Link>
          )}
          <ThemeButton />
          <UserMenu compact={mobile} />
        </div>
        <main className="ad-content">{children}</main>
      </div>
      {mobile && navOpen && (
        <div className="drawer-nav">
          <Sidebar />
          <div className="scrim" onClick={() => setNavOpen(false)} />
        </div>
      )}
    </div>
  );
}

export const TableSkel = ({
  cols,
  rows = 5,
}: {
  cols: number;
  rows?: number;
}) => (
  <div className="panel">
    <div
      className="panel-b"
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols},1fr)`,
            gap: 16,
          }}
        >
          {Array.from({ length: cols }, (_, c) => (
            <Skel key={c} w="80%" h={16} />
          ))}
        </div>
      ))}
    </div>
  </div>
);
