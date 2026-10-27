import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  type: ToastType;
  title: string;
  msg?: string;
  action?: { label: string; to: string };
}

type ShowToast = (
  type: ToastType,
  title: string,
  msg?: string,
  action?: ToastItem['action'],
) => void;

const ToastContext = createContext<ShowToast>(() => {});

const icons: Record<ToastType, IconName> = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'info',
  warning: 'alert-triangle',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback(
    (id: number) => setToasts((l) => l.filter((t) => t.id !== id)),
    [],
  );

  const show = useCallback<ShowToast>(
    (type, title, msg, action) => {
      const id = ++nextId.current;
      setToasts((l) => [...l.slice(-2), { id, type, title, msg, action }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function ToastView({
  toast,
  onClose,
}: {
  toast: Omit<ToastItem, 'id'>;
  onClose?: () => void;
}) {
  return (
    <div
      className={`toast t-${toast.type}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
    >
      <span className="t-ic">
        <Icon name={icons[toast.type]} size={16} />
      </span>
      <div className="t-body">
        <b>{toast.title}</b>
        {toast.msg && <p>{toast.msg}</p>}
        {toast.action && (
          <div className="t-act">
            <Link
              className="btn btn-secondary btn-sm"
              to={toast.action.to}
              onClick={onClose}
            >
              {toast.action.label}
            </Link>
          </div>
        )}
      </div>
      <button
        className="icon-btn sm"
        onClick={onClose}
        aria-label="Fechar aviso"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export const useToast = () => useContext(ToastContext);
