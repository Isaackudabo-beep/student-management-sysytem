// Purpose: Small reusable UI primitives for forms and feedback.
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-3xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)]", className)}>
      {children}
    </div>
  );
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  return (
    <button
      className={clsx(
        "rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50",
        variant === "primary" && "bg-brand text-white",
        variant === "secondary" && "border border-line bg-white text-ink",
        variant === "danger" && "bg-danger text-white",
        className
      )}
      {...props}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
      {...props}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
      {...props}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-ink">{children}</label>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <p className="mt-2 text-sm text-danger">{children}</p> : null;
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">{value}</p>
    </Card>
  );
}
