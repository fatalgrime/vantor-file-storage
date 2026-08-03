'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-[18px] w-[18px]" />,
  error: <XCircle className="h-[18px] w-[18px]" />,
  warning: <AlertTriangle className="h-[18px] w-[18px]" />,
  info: <Info className="h-[18px] w-[18px]" />,
};

const TOAST_STYLES: Record<ToastType, { container: string; icon: string; title: string }> = {
  success: {
    container: 'border-emerald-500/30 bg-gradient-to-r from-emerald-950/90 to-[#071218]/95',
    icon: 'text-emerald-400',
    title: 'text-emerald-100',
  },
  error: {
    container: 'border-red-500/30 bg-gradient-to-r from-red-950/90 to-[#120708]/95',
    icon: 'text-red-400',
    title: 'text-red-100',
  },
  warning: {
    container: 'border-amber-500/30 bg-gradient-to-r from-amber-950/90 to-[#121008]/95',
    icon: 'text-amber-400',
    title: 'text-amber-100',
  },
  info: {
    container: 'border-blue-500/30 bg-gradient-to-r from-blue-950/90 to-[#070c18]/95',
    icon: 'text-blue-400',
    title: 'text-blue-100',
  },
};

const ACCENT_BARS: Record<ToastType, string> = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const startRef = useRef(Date.now());
  const duration = toast.duration ?? 4000;

  const dismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, duration);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(interval);
    };
  }, [dismiss, duration]);

  const style = TOAST_STYLES[toast.type];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl
        transition-all duration-300 ease-out w-[380px] pointer-events-auto
        ${style.container}
        ${isExiting
          ? 'translate-x-[120%] opacity-0 scale-95'
          : 'translate-x-0 opacity-100 scale-100 animate-slide-in-right'
        }
      `}
      role="alert"
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${ACCENT_BARS[toast.type]}`} />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <div className={`mt-0.5 flex-shrink-0 ${style.icon}`}>
          {TOAST_ICONS[toast.type]}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold leading-tight ${style.title}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-1 text-[12px] leading-snug text-slate-400">
              {toast.message}
            </p>
          )}
        </div>

        <button
          onClick={dismiss}
          className="flex-shrink-0 rounded-md p-1 text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-[2px] w-full bg-white/5">
        <div
          className={`h-full transition-all duration-100 ease-linear ${ACCENT_BARS[toast.type]} opacity-50`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}

      {/* Toast container — bottom-right */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
