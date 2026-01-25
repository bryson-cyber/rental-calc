import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToastProps {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
}

const variantStyles = {
  default: "bg-white border-slate-200 text-slate-900",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900",
  error: "bg-red-50 border-red-200 text-red-900",
  warning: "bg-amber-50 border-amber-200 text-amber-900",
  info: "bg-blue-50 border-blue-200 text-blue-900",
};

const iconColors = {
  default: "text-slate-500",
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};

export function Toast({
  title,
  description,
  variant = "default",
  onClose,
}: ToastProps) {
  return (
    <div
      className={cn(
        "pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border shadow-lg",
        "animate-in slide-in-from-top-full fade-in duration-300",
        variantStyles[variant]
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-1">
            {title && (
              <p className="text-sm font-semibold leading-none">{title}</p>
            )}
            {description && (
              <p className="text-sm opacity-90">{description}</p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors",
                "hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2",
                iconColors[variant]
              )}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Toast Container for positioning
export function ToastContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {children}
    </div>
  );
}
