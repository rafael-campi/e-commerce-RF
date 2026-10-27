import { Component, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../lib/auth';
import { date, fullName, initials } from '../lib/format';
import { RoleBadge, StateBlock } from '../ui/components';
import { Icon } from '../ui/Icon';
import { Header } from './Header';

export function ProfilePage() {
  const u = useUser();
  return (
    <>
      <Header />
      <main className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Conta</p>
            <h1 className="h1">Meu perfil</h1>
          </div>
        </div>
        <div className="profile">
          <div className="panel pf-card">
            <span className="avatar lg">{initials(u)}</span>
            <h2 className="h3">{fullName(u)}</h2>
            <p className="muted">{u.email}</p>
            <RoleBadge role={u.role} />
          </div>
          <section className="panel">
            <div className="panel-h">
              <h2 className="h4">Dados da conta</h2>
              <span className="faint small">
                ID <span className="mono">#{u.id}</span>
              </span>
            </div>
            <div className="panel-b">
              <div className="dl">
                <div className="dt">E-mail</div>
                <div>{u.email}</div>
                <div className="dt">Nome</div>
                <div>{u.firstName ?? '—'}</div>
                <div className="dt">Sobrenome</div>
                <div>{u.lastName ?? '—'}</div>
                <div className="dt">Papel</div>
                <div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="dt">Cliente desde</div>
                <div className="num">{date(u.createdAt)}</div>
              </div>
              <p className="help" style={{ marginTop: 14 }}>
                <Icon name="lock" size={14} />
                <span>Sua senha não é exibida por segurança.</span>
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export function ForbiddenPage() {
  return (
    <>
      <Header />
      <main className="page">
        <StateBlock
          tone="danger"
          icon="shield-x"
          code="403 · Forbidden"
          title="Você não tem permissão para acessar esta página"
          actions={
            <Link className="btn btn-primary" to="/produtos">
              Voltar para a loja
            </Link>
          }
        >
          Esta área é restrita a administradores. Se você acha que deveria ter
          acesso, fale com a equipe da loja.
        </StateBlock>
      </main>
    </>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <>
      <Header />
      <main className="page">
        <StateBlock
          tone="warning"
          icon="search-x"
          code="404 · Not Found"
          title="Página não encontrada"
          actions={
            <>
              <Link className="btn btn-primary" to="/produtos">
                Ver produtos
              </Link>
              <button
                className="btn btn-secondary"
                onClick={() => navigate(-1)}
              >
                Voltar
              </button>
            </>
          }
        >
          O endereço pode estar digitado errado ou a página foi removida.
        </StateBlock>
      </main>
    </>
  );
}

function ServerErrorPage({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="page">
      <StateBlock
        tone="danger"
        icon="server"
        code="500"
        title="Algo deu errado do nosso lado"
        actions={
          <>
            <button className="btn btn-primary" onClick={onRetry}>
              <Icon name="refresh" size={18} />
              Tentar novamente
            </button>
            <a className="btn btn-secondary" href="/produtos">
              Ir para produtos
            </a>
          </>
        }
      >
        A página não respondeu como esperado. Seus carrinhos e dados estão
        salvos. Tente novamente em alguns instantes.
      </StateBlock>
    </main>
  );
}

/** Erro inesperado em qualquer tela vira a página de erro 500 do protótipo. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return <ServerErrorPage onRetry={() => location.reload()} />;
    return this.props.children;
  }
}
