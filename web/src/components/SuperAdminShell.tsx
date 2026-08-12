"use client";

// Purpose: Platform SUPER_ADMIN shell — visually distinct from school AppShell.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schools", label: "Schools" },
];

export function SuperAdminShell({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/admin/login");
      return;
    }
    if (user.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user || user.role !== "SUPER_ADMIN") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b1c24] text-white/70">
        Loading platform…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1c24] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-white/10 bg-[#122833] p-5 md:block">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7ec8c8]">Platform</p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
            Super Admin
          </h2>
          <p className="mt-2 text-sm text-white/60">{user.fullName}</p>
          <nav className="mt-8 space-y-1">
            {NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "block rounded-xl px-3 py-2 text-sm font-semibold transition",
                  pathname === link.href
                    ? "bg-[#7ec8c8] text-[#0b1c24]"
                    : "text-white/80 hover:bg-white/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/admin/login");
            }}
            className="mt-8 w-full rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold"
          >
            Sign out
          </button>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-6 flex items-center justify-between gap-3 rounded-3xl border border-white/10 bg-[#122833] px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-xl border border-white/15 p-2.5 md:hidden"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2">
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                {title}
              </h1>
            </div>
          </header>
          {children}
        </section>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(85vw,18rem)] bg-[#122833] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7ec8c8]">Platform</p>
            <nav className="mt-6 space-y-1">
              {NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-xl px-3 py-3 text-sm font-semibold"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
