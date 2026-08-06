'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

const TOAST_CONFIG: Record<ToastType, { icon: React.ReactNode; iconBg: string; iconColor: string; borderColor: string; progressColor: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    progressColor: 'bg-emerald-500',
  },
  error: {
    icon: <XCircle className="h-4 w-4" />,
    iconBg: 'bg-rose-500/10 border-rose-500/20',
    iconColor: 'text-rose-400',
    borderColor: 'border-rose-500/20',
    progressColor: 'bg-rose-500',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4" />,
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
    borderColor: 'border-amber-500/20',
    progressColor: 'bg-amber-500',
  },
  info: {
    icon: <Info className="h-4 w-4" />,
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconColor: 'text-blue-400',
    borderColor: 'border-blue-500/20',
    progressColor: 'bg-blue-500',
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 4000;
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const startTime = Date.now();
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 40);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onDismiss, toast.id, duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92, transition: { duration: 0.2, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className={`relative w-80 sm:w-96 overflow-hidden rounded-xl border bg-[#090f22]/95 p-3.5 shadow-2xl backdrop-blur-xl pointer-events-auto ${config.borderColor}`}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border flex-shrink-0 ${config.iconBg} ${config.iconColor}`}>
          {config.icon}
        </div>

        <div className="flex-1 min-w-0 font-sans pr-1">
          <p className="text-xs font-semibold text-white tracking-tight leading-tight">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-1 text-[11px] font-normal leading-normal text-slate-400">
              {toast.message}
            </p>
          )}
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-slate-800/60 overflow-hidden">
        <div
          className={`h-full transition-all duration-75 ease-linear ${config.progressColor} opacity-70`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
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
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col-reverse gap-2.5 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
