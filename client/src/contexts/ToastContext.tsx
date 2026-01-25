import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { Toast, ToastContainer, ToastProps } from "@/components/ui/toast";

type ToastType = Omit<ToastProps, "id" | "onClose">;

interface ToastContextValue {
  toast: (props: ToastType) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastWithId extends ToastProps {
  id: string;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastWithId[]>([]);
  const toastIdRef = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (props: ToastType) => {
      const id = `toast-${++toastIdRef.current}`;
      const duration = props.duration ?? 5000;

      setToasts((prev) => [...prev, { ...props, id }]);

      // Auto-dismiss after duration
      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "success" });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "error", duration: 8000 });
    },
    [toast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "warning" });
    },
    [toast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      toast({ title, description, variant: "info" });
    },
    [toast]
  );

  return (
    <ToastContext.Provider
      value={{ toast, success, error, warning, info, dismiss, dismissAll }}
    >
      {children}
      <ToastContainer>
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onClose={() => dismiss(t.id)} />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}
