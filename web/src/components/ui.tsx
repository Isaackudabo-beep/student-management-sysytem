"use client";

// Purpose: Toast feedback + loading-aware button primitives.
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={clsx("rounded-3xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)]", className)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  loading,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={clsx(
        "relative inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" && "bg-brand text-white hover:bg-brand/90",
        variant === "secondary" && "border border-line bg-white text-ink hover:bg-brand-soft",
        variant === "danger" && "bg-danger text-white hover:bg-danger/90",
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          className={clsx(
            "inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2",
            variant === "secondary"
              ? "border-brand/25 border-t-brand"
              : "border-white/35 border-t-white"
          )}
          aria-hidden
        />
      ) : null}
      <span className={clsx(loading && "opacity-90")}>{children}</span>
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2 disabled:opacity-60"
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={clsx(
          "min-h-11 w-full appearance-none rounded-xl border border-line bg-white px-3 py-2.5 pr-10 outline-none ring-brand focus:ring-2 disabled:opacity-60",
          className
        )}
        {...props}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        aria-hidden
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
          <path d="M5.25 7.5 10 12.25 14.75 7.5" />
        </svg>
      </span>
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-ink">{children}</label>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p className="mt-2 whitespace-pre-line text-sm text-danger">{children}</p>
  ) : null;
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">{value}</p>
    </Card>
  );
}

type Toast = { id: number; type: "success" | "error"; message: string };

const ToastContext = createContext<{
  push: (type: "success" | "error", message: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[var(--shadow)]",
              t.type === "success"
                ? "border-brand/30 bg-brand text-white"
                : "border-danger/30 bg-danger text-white"
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: (_type: "success" | "error", _message: string) => undefined,
      success: (_message: string) => undefined,
      error: (_message: string) => undefined,
    };
  }
  return {
    push: ctx.push,
    success: (message: string) => ctx.push("success", message),
    error: (message: string) => ctx.push("error", message),
  };
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand/15 font-semibold text-brand",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-11 w-11 text-sm",
        size === "lg" && "h-14 w-14 text-base"
      )}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

/** Simple CSS bar chart — no external chart library. */
export function BarChart({
  items,
  valueSuffix = "",
}: {
  items: Array<{ label: string; value: number }>;
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-muted">No data yet</p>
      ) : (
        items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted">
                {item.value}
                {valueSuffix}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-brand-soft">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${Math.round((item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
