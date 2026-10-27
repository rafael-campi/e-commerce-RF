import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useUser } from '../lib/auth';
import { useDevice } from '../lib/device';
import { date, fullName, initials, isEmail, roleName } from '../lib/format';
import { ROLE, type RoleId, type User } from '../lib/types';
import {
  Alert,
  Field,
  LoadError,
  Modal,
  RoleBadge,
  StateBlock,
} from '../ui/components';
import { Icon } from '../ui/Icon';
import { useToast } from '../ui/toast';
import { AdminShell, TableSkel, useUsers } from './AdminShell';

const ROLES: [RoleId, string][] = [
  [ROLE.ADMIN, 'Acesso total: produtos, usuários e pedidos'],
  [
    ROLE.MODERATOR,
    'Papel intermediário; hoje com as mesmas permissões de cliente',
  ],
  [ROLE.USER, 'Cliente: compra e vê o próprio perfil'],
];

function EditUser({
  user,
  self,
  onClose,
}: {
  user: User;
  self: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState({
    email: user.email,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    role: user.role,
  });
  const [errors, setErrors] = useState<{
    email?: string;
    firstName?: string;
    taken?: boolean;
  }>({});

  const save = useMutation({
    mutationFn: () =>
      api.updateUser(user.id, {
        ...v,
        email: v.email.trim().toLowerCase(),
        firstName: v.firstName.trim(),
        lastName: v.lastName.trim(),
      }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      if (self) await queryClient.invalidateQueries({ queryKey: ['me'] });
      onClose();
      toast(
        'success',
        'Usuário atualizado',
        `${fullName(updated)} agora é ${roleName(updated.role)}.`,
      );
    },
    onError: (error) => {
      // e-mail em uso volta como 400 com mensagem própria
      if (
        error instanceof ApiError &&
        error.status === 400 &&
        /e-mail/i.test(error.message)
      )
        setErrors({
          email: 'Este e-mail já está em uso por outro usuário.',
          taken: true,
        });
      else toast('error', 'Não foi possível salvar', error.message);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er: typeof errors = {};
    if (!isEmail(v.email.trim())) er.email = 'Digite um e-mail válido.';
    if (!v.firstName.trim()) er.firstName = 'Informe o nome.';
    setErrors(er);
    if (!Object.keys(er).length) save.mutate();
  };

  const busy = save.isPending;
  return (
    <Modal label="Editar usuário" onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: 'contents' }}>
        <div className="m-head">
          <span
            className="avatar"
            style={{ width: 44, height: 44, fontSize: 15 }}
          >
            {initials({ ...v, email: v.email || '?' })}
          </span>
          <div className="grow">
            <h2 className="h3">Editar usuário</h2>
            <p className="muted">ID #{user.id}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="m-body">
          {errors.taken && (
            <Alert tone="danger" title="E-mail já em uso">
              Outro usuário já usa este e-mail. Escolha um endereço diferente.
            </Alert>
          )}
          <Field
            id="uf-email"
            label="E-mail"
            type="email"
            value={v.email}
            onChange={(email) => setV({ ...v, email })}
            error={errors.email}
            disabled={busy}
          />
          <div className="row2">
            <Field
              id="uf-nome"
              label="Nome"
              value={v.firstName}
              onChange={(firstName) => setV({ ...v, firstName })}
              error={errors.firstName}
              disabled={busy}
            />
            <Field
              id="uf-sobrenome"
              label="Sobrenome"
              value={v.lastName}
              onChange={(lastName) => setV({ ...v, lastName })}
              disabled={busy}
            />
          </div>
          <div className="field">
            <span style={{ fontWeight: 500 }}>Papel</span>
            <div className="roles" role="radiogroup" aria-label="Papel">
              {ROLES.map(([role, desc]) => (
                <button
                  key={role}
                  type="button"
                  className="rcard"
                  role="radio"
                  aria-checked={v.role === role}
                  disabled={busy || (self && role !== ROLE.ADMIN)}
                  onClick={() => setV({ ...v, role })}
                >
                  <span className="radio" />
                  <span style={{ flex: 1 }}>
                    <span className="rc-t">{roleName(role)}</span>
                    <br />
                    <span className="rc-d">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            {self && (
              <p className="help">
                <Icon name="info" size={14} />
                <span>Você não pode rebaixar o próprio papel.</span>
              </p>
            )}
          </div>
        </div>
        <div className="m-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn btn-primary${busy ? ' is-loading' : ''}`}
          >
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RemoveUser({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: () => api.deleteUser(user.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
      toast(
        'success',
        'Usuário removido',
        `${user.email} não tem mais acesso.`,
      );
    },
    onError: (error) =>
      toast('error', 'Não foi possível remover', error.message),
  });

  return (
    <Modal small label={`Remover ${fullName(user)}`} onClose={onClose}>
      <div className="m-head">
        <div className="m-ic danger">
          <Icon name="trash" size={22} />
        </div>
        <div className="grow">
          <h2 className="h3">Remover {fullName(user)}?</h2>
          <p className="muted">
            A conta {user.email} perde o acesso imediatamente. Essa ação não
            pode ser desfeita.
          </p>
        </div>
      </div>
      <div className="m-foot" style={{ border: 0 }}>
        <button className="btn btn-secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className={`btn btn-danger${remove.isPending ? ' is-loading' : ''}`}
          onClick={() => remove.mutate()}
        >
          Remover usuário
        </button>
      </div>
    </Modal>
  );
}

export function AdminUsersPage() {
  const me = useUser();
  const mobile = useDevice() === 'mobile';
  const users = useUsers();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);

  const all = users.data ?? [];
  const term = q.trim().toLowerCase();
  const list = all.filter(
    (u) => !term || `${u.email} ${fullName(u)}`.toLowerCase().includes(term),
  );
  const count = (role: RoleId) => all.filter((u) => u.role === role).length;

  let body;
  if (users.isPending) body = <TableSkel cols={5} rows={6} />;
  else if (users.isError)
    body = (
      <LoadError
        what="os usuários"
        code="GET /users"
        onRetry={() => users.refetch()}
      />
    );
  else if (!list.length)
    body = (
      <StateBlock icon="users" title="Nenhum usuário encontrado" boxed>
        {term
          ? 'Confira o e-mail ou o nome buscado.'
          : 'Ainda não há usuários cadastrados.'}
      </StateBlock>
    );
  else if (mobile)
    body = (
      <div className="panel mlist">
        {list.map((u) => (
          <div className="mrow" key={u.id}>
            <span className="avatar">{initials(u)}</span>
            <div className="grow">
              <b>{fullName(u)}</b>
              <span className="small faint">{u.email}</span>
              <br />
              <span style={{ display: 'inline-block', marginTop: 4 }}>
                <RoleBadge role={u.role} />
              </span>
            </div>
            <button
              className="icon-btn sm"
              onClick={() => setEditing(u)}
              aria-label={`Editar ${fullName(u)}`}
            >
              <Icon name="pencil" size={18} />
            </button>
            <button
              className="icon-btn sm danger"
              onClick={() => setRemoving(u)}
              disabled={u.id === me.id}
              aria-label={`Remover ${fullName(u)}`}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        ))}
      </div>
    );
  else
    body = (
      <div className="panel tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Cadastro</th>
              <th className="r">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id}>
                <td className="mono faint">#{u.id}</td>
                <td>
                  <div className="c-prod">
                    <span className="avatar">{initials(u)}</span>
                    <b>
                      {fullName(u)}
                      {u.id === me.id && (
                        <span
                          className="faint small"
                          style={{ fontWeight: 400 }}
                        >
                          {' '}
                          (você)
                        </span>
                      )}
                    </b>
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <RoleBadge role={u.role} />
                </td>
                <td className="num faint">{date(u.createdAt)}</td>
                <td>
                  <div className="acts">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditing(u)}
                    >
                      <Icon name="pencil" size={16} />
                      Editar
                    </button>
                    <button
                      className="icon-btn sm danger"
                      onClick={() => setRemoving(u)}
                      disabled={u.id === me.id}
                      title={
                        u.id === me.id
                          ? 'Você não pode remover a própria conta'
                          : undefined
                      }
                      aria-label={`Remover ${fullName(u)}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <AdminShell crumb="Usuários">
      <div className="dash-head">
        <div>
          <h1 className="h1">Usuários</h1>
          <p className="muted">
            {users.isPending
              ? 'Carregando…'
              : `${all.length} usuários · ${count(ROLE.ADMIN)} ADMIN · ${count(ROLE.MODERATOR)} MODERATOR · ${count(ROLE.USER)} USER`}
          </p>
        </div>
      </div>
      <div className="filters">
        <form
          style={{ flex: 1, maxWidth: 380 }}
          onSubmit={(e) => e.preventDefault()}
        >
          <Field
            id="ubusca"
            label={<span className="sr">Buscar usuário</span>}
            icon="search"
            placeholder="Buscar por nome ou e-mail"
            value={q}
            onChange={setQ}
          />
        </form>
      </div>
      {body}
      {editing && (
        <EditUser
          user={editing}
          self={editing.id === me.id}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && (
        <RemoveUser user={removing} onClose={() => setRemoving(null)} />
      )}
    </AdminShell>
  );
}
