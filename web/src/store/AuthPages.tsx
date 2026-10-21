import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useDevice } from '../lib/device';
import { isEmail } from '../lib/format';
import { ROLE } from '../lib/types';
import {
  Alert,
  Art,
  Field,
  Logo,
  PasswordToggle,
  ThemeButton,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';

function AuthLayout({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  const mobile = useDevice() === 'mobile';
  return (
    <div className="auth">
      <aside className="auth-side">
        <div className="collage">
          {[1, 5, 12].map((id) => (
            <Art key={id} productId={id} size={44} />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 440,
          }}
        >
          <p className="eyebrow">Prateleira</p>
          <h1 className="display">{title}</h1>
          <p className="body-l muted">{sub}</p>
        </div>
        <div className="benefits">
          <div>
            <Icon name="zap" size={18} />
            Pix com aprovação na hora
          </div>
          <div>
            <Icon name="card" size={18} />
            Cartão de crédito com confirmação imediata
          </div>
          <div>
            <Icon name="package" size={18} />
            Estoque atualizado a cada compra
          </div>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {mobile ? <Logo to="/entrar" /> : <span />}
            <ThemeButton />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login, note } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [failure, setFailure] = useState('');
  // vindo de uma rota protegida: para onde voltar e por quê
  const redirect = location.state as { from?: string; note?: string } | null;
  const notice = wrong || failure ? '' : note || redirect?.note;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!email.trim()) er.email = 'Informe seu e-mail.';
    else if (!isEmail(email.trim()))
      er.email = 'Digite um e-mail válido, como nome@email.com.';
    if (!password) er.password = 'Informe sua senha.';
    setErrors(er);
    setWrong(false);
    setFailure('');
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      const user = await login(email.trim(), password);
      const from = redirect?.from;
      navigate(
        from ?? (user.role === ROLE.ADMIN ? '/admin/produtos' : '/produtos'),
        { replace: true },
      );
      toast(
        'success',
        `Olá, ${user.firstName ?? user.email}!`,
        'Você entrou na sua conta.',
      );
    } catch (error) {
      setPassword('');
      if (error instanceof ApiError && error.status === 401) setWrong(true);
      else
        setFailure(error instanceof Error ? error.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Entre e continue de onde parou."
      sub="Seus carrinhos ficam salvos na sua conta, prontos para o pagamento."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="h2">Entrar</h1>
        <p className="muted">Use o e-mail e a senha da sua conta.</p>
      </div>
      {notice && <Alert tone="info">{notice}</Alert>}
      {wrong && (
        <Alert tone="danger" title="E-mail ou senha incorretos">
          Confira os dados e tente de novo. Se esqueceu a senha, fale com o
          suporte.
        </Alert>
      )}
      {failure && (
        <Alert tone="danger" title="Não foi possível entrar">
          {failure}
        </Alert>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <Field
          id="l-email"
          label="E-mail"
          type="email"
          icon="mail"
          placeholder="voce@email.com"
          value={email}
          onChange={setEmail}
          error={errors.email}
          disabled={busy}
          autoComplete="email"
          className={wrong ? 'is-error' : ''}
        />
        <Field
          id="l-senha"
          label="Senha"
          type={showPw ? 'text' : 'password'}
          icon="lock"
          placeholder="Sua senha"
          value={password}
          onChange={setPassword}
          error={errors.password}
          disabled={busy}
          autoComplete="current-password"
          className={wrong ? 'is-error' : ''}
          right={
            <PasswordToggle
              shown={showPw}
              onToggle={() => setShowPw(!showPw)}
            />
          }
        />
        <button
          className={`btn btn-primary btn-lg btn-block ${busy ? 'is-loading' : ''}`}
          type="submit"
        >
          Entrar
        </button>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>
        Ainda não tem conta? <Link to="/cadastro">Criar conta</Link>
      </p>
      <div className="demo">
        <span>
          Contas de demonstração (senha <span className="mono">123456</span>):
        </span>
        <div className="demo-row">
          {[
            ['cliente@prateleira.com', 'USER'],
            ['admin@prateleira.com', 'ADMIN'],
          ].map(([demo, role]) => (
            <button
              key={demo}
              type="button"
              onClick={() => {
                setEmail(demo);
                setPassword('123456');
                setErrors({});
                setWrong(false);
              }}
            >
              {demo} · {role}
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [v, setV] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>(
    {},
  );
  const [emailTaken, setEmailTaken] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (value: string) =>
    setV({ ...v, [k]: value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const data = {
      ...v,
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim().toLowerCase(),
    };
    const er: typeof errors = {};
    if (!data.firstName) er.firstName = 'Informe seu nome.';
    if (!data.lastName) er.lastName = 'Informe seu sobrenome.';
    if (!isEmail(data.email))
      er.email = 'Digite um e-mail válido, como nome@email.com.';
    if (data.password.length < 6)
      er.password = 'A senha precisa ter pelo menos 6 caracteres.';
    setErrors(er);
    setEmailTaken(false);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      await api.register(data);
      const user = await login(data.email, data.password);
      navigate('/produtos', { replace: true });
      toast(
        'success',
        'Conta criada',
        `Bem-vindo(a), ${user.firstName}! Você já pode montar seu carrinho.`,
      );
    } catch (error) {
      // a API responde 400 com uma mensagem única quando o e-mail já existe
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        /e-mail/i.test(error.message)
      ) {
        setEmailTaken(true);
        setErrors({
          email: 'Este e-mail já está cadastrado. Entre com ele ou use outro.',
        });
      } else {
        toast(
          'error',
          'Não foi possível criar a conta',
          error instanceof Error ? error.message : '',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Crie sua conta em menos de um minuto."
      sub="Com a conta você monta vários carrinhos e paga cada um com Pix ou cartão."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="h2">Criar conta</h1>
        <p className="muted">Preencha seus dados para começar a comprar.</p>
      </div>
      {emailTaken && (
        <Alert
          tone="danger"
          title="Não foi possível criar a conta"
          actions={
            <Link className="btn btn-secondary btn-sm" to="/entrar">
              Entrar com este e-mail
            </Link>
          }
        >
          Já existe uma conta com este e-mail.
        </Alert>
      )}
      <form className="form" onSubmit={submit} noValidate>
        <div className="row2">
          <Field
            id="c-nome"
            label="Nome"
            placeholder="Seu nome"
            value={v.firstName}
            onChange={set('firstName')}
            error={errors.firstName}
            disabled={busy}
            autoComplete="given-name"
          />
          <Field
            id="c-sobrenome"
            label="Sobrenome"
            placeholder="Seu sobrenome"
            value={v.lastName}
            onChange={set('lastName')}
            error={errors.lastName}
            disabled={busy}
            autoComplete="family-name"
          />
        </div>
        <Field
          id="c-email"
          label="E-mail"
          type="email"
          icon="mail"
          placeholder="voce@email.com"
          value={v.email}
          onChange={set('email')}
          error={errors.email}
          disabled={busy}
          autoComplete="email"
        />
        <Field
          id="c-senha"
          label="Senha"
          type={showPw ? 'text' : 'password'}
          icon="lock"
          placeholder="Mínimo de 6 caracteres"
          value={v.password}
          onChange={set('password')}
          error={errors.password}
          help="Use pelo menos 6 caracteres."
          disabled={busy}
          autoComplete="new-password"
          right={
            <PasswordToggle
              shown={showPw}
              onToggle={() => setShowPw(!showPw)}
            />
          }
        />
        <button
          className={`btn btn-primary btn-lg btn-block ${busy ? 'is-loading' : ''}`}
          type="submit"
        >
          Criar conta
        </button>
        <p className="help">
          <Icon name="info" size={14} />
          <span>
            Toda conta nova é de cliente. Perfis de administrador são definidos
            pela equipe da loja.
          </span>
        </p>
      </form>
      <p className="muted" style={{ textAlign: 'center' }}>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </AuthLayout>
  );
}
