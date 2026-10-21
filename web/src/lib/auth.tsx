import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api, setUnauthorizedHandler, token } from './api';
import { ROLE, type User } from './types';

interface Auth {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  /** Aviso mostrado na tela de login (ex.: sessão expirada). */
  note: string;
  setNote: (note: string) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [hasToken, setHasToken] = useState(() => !!token.get());
  const [note, setNote] = useState('');

  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: hasToken,
    retry: false,
  });

  const clearSession = useCallback(() => {
    token.set(null);
    setHasToken(false);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setNote('Sua sessão expirou. Entre novamente para continuar.');
      navigate('/entrar');
    });
  }, [clearSession, navigate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.login(email, password);
      token.set(access_token);
      const user = await queryClient.fetchQuery({
        queryKey: ['me'],
        queryFn: api.me,
      });
      setHasToken(true);
      setNote('');
      return user;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    clearSession();
    setNote('');
    navigate('/entrar');
  }, [clearSession, navigate]);

  const user = hasToken ? (me.data ?? null) : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: hasToken && me.isPending,
        isAdmin: user?.role === ROLE.ADMIN,
        note,
        setNote,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth fora do AuthProvider');
  return auth;
}

/** Usuário logado; só use dentro de rotas protegidas. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useUser sem usuário logado');
  return user;
}
