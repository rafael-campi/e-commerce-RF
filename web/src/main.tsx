import { lazy, StrictMode, Suspense, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import './lib/theme';
import { ApiError } from './lib/api';
import { AuthProvider, useAuth } from './lib/auth';
import { useDevice } from './lib/device';
import { ToastProvider } from './ui/toast';
import { LoginPage, SignupPage } from './store/AuthPages';
import { ProductDetailPage, ProductsPage } from './store/ProductPages';
import { CartsPage } from './store/CartsPage';
import { ConfirmationPage, PaymentPage } from './store/CheckoutPages';
import {
  ErrorBoundary,
  ForbiddenPage,
  NotFoundPage,
  ProfilePage,
} from './store/MiscPages';
import { AdminDashboardPage } from './admin/AdminDashboard';
import { AdminProductsPage } from './admin/AdminProducts';
import { AdminUsersPage } from './admin/AdminUsers';
import { AdminOrdersPage } from './admin/AdminOrders';

// Só existe em desenvolvimento: no build de produção a rota e o arquivo somem.
const DesignSystem = import.meta.env.DEV
  ? lazy(() => import('./ds/DesignSystem'))
  : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // 4xx não melhora tentando de novo
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && count < 2,
    },
  },
});

const Boot = () => (
  <div className="boot" aria-busy="true">
    <span className="spin lg" />
  </div>
);

/** Rotas que exigem login; com `admin`, também o papel ADMIN (senão, página 403). */
function Protected({
  admin,
  children,
}: {
  admin?: boolean;
  children: ReactNode;
}) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <Boot />;
  if (!user)
    return (
      <Navigate
        to="/entrar"
        replace
        state={{
          from: location.pathname + location.search,
          note: 'Entre na sua conta para continuar.',
        }}
      />
    );
  if (admin && !isAdmin) return <ForbiddenPage />;
  return <>{children}</>;
}

/** Login e cadastro: quem já entrou vai direto para a loja (ou para o admin). */
function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <Boot />;
  if (user) return <Navigate to={isAdmin ? '/admin' : '/produtos'} replace />;
  return <>{children}</>;
}

function App() {
  const device = useDevice();
  return (
    <div className="app" data-device={device}>
      <ToastProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/produtos" replace />} />
            <Route
              path="/entrar"
              element={
                <GuestOnly>
                  <LoginPage />
                </GuestOnly>
              }
            />
            <Route
              path="/cadastro"
              element={
                <GuestOnly>
                  <SignupPage />
                </GuestOnly>
              }
            />

            <Route
              path="/produtos"
              element={
                <Protected>
                  <ProductsPage />
                </Protected>
              }
            />
            <Route
              path="/produtos/:id"
              element={
                <Protected>
                  <ProductDetailPage />
                </Protected>
              }
            />
            <Route
              path="/carrinhos"
              element={
                <Protected>
                  <CartsPage />
                </Protected>
              }
            />
            <Route
              path="/carrinhos/:id/pagamento"
              element={
                <Protected>
                  <PaymentPage />
                </Protected>
              }
            />
            <Route
              path="/pedidos/:id"
              element={
                <Protected>
                  <ConfirmationPage />
                </Protected>
              }
            />
            <Route
              path="/perfil"
              element={
                <Protected>
                  <ProfilePage />
                </Protected>
              }
            />

            <Route
              path="/admin"
              element={
                <Protected admin>
                  <AdminDashboardPage />
                </Protected>
              }
            />
            <Route
              path="/admin/produtos"
              element={
                <Protected admin>
                  <AdminProductsPage />
                </Protected>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <Protected admin>
                  <AdminUsersPage />
                </Protected>
              }
            />
            <Route
              path="/admin/pedidos"
              element={
                <Protected admin>
                  <AdminOrdersPage />
                </Protected>
              }
            />

            {DesignSystem && (
              <Route
                path="/design-system"
                element={
                  <Suspense fallback={<Boot />}>
                    <DesignSystem />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </ToastProvider>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
