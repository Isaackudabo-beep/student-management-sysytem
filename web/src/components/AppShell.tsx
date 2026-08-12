"use client";

// Purpose: Auth gate + sidebar shell with role nav and forced password-change redirect.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { dashboardPath, useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/NotificationBell";
import type { Role } from "@/lib/types";

const NAV: Array<{ href: string; label: string; roles: Role[] }> = [
  { href: "/dashboard/admin", label: "Dashboard", roles: ["ADMIN"] },
  { href: "/dashboard/teacher", label: "Dashboard", roles: ["TEACHER"] },
  { href: "/dashboard/student", label: "Dashboard", roles: ["STUDENT"] },
  { href: "/students", label: "Students", roles: ["ADMIN", "TEACHER"] },
  { href: "/classes", label: "Classes", roles: ["ADMIN"] },
  { href: "/teachers", label: "Teachers", roles: ["ADMIN"] },
  { href: "/subjects", label: "Subjects", roles: ["ADMIN", "TEACHER"] },
  { href: "/enrollments", label: "Enrollments", roles: ["ADMIN"] },
  { href: "/term", label: "Session", roles: ["ADMIN"] },
  { href: "/scores", label: "Scores", roles: ["ADMIN", "TEACHER"] },
  { href: "/announcements", label: "Announcements", roles: ["ADMIN"] },
  { href: "/results", label: "My Results", roles: ["STUDENT"] },
];

function rolesForPath(pathname: string): Role[] | null {
  const exact = NAV.find((item) => item.href === pathname);
  if (exact) return exact.roles;
  const prefix = NAV.find((item) => pathname.startsWith(item.href + "/"));
  return prefix?.roles ?? null;
}

export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    if (user.role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
      return;
    }
    if (user.mustChangePassword && pathname !== "/change-password") {
      router.replace("/change-password");
      return;
    }
    const allowed = rolesForPath(pathname);
    if (allowed && !allowed.includes(user.role)) {
      router.replace(dashboardPath(user.role));
    }
  }, [loading, user, router, pathname]);

  // Close the mobile menu on navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock scroll and support Escape while the mobile menu is open.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Loading workspace…
      </main>
    );
  }

  if (user.mustChangePassword && pathname !== "/change-password") {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Redirecting to password change…
      </main>
    );
  }

  const allowed = rolesForPath(pathname);
  if (allowed && !allowed.includes(user.role)) {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Redirecting to your dashboard…
      </main>
    );
  }

  const links = NAV.filter((item) => item.roles.includes(user.role));

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6 md:px-6">
      <aside className="no-print hidden w-64 shrink-0 rounded-3xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)] md:block">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">SMS</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold">
          School Desk
        </h2>
        <p className="mt-2 text-sm text-muted">
          {user.fullName} · {user.role}
        </p>
        <nav className="mt-8 space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "block rounded-xl px-3 py-2 text-sm font-semibold transition",
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "bg-brand text-white"
                  : "text-ink hover:bg-brand-soft"
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
            router.replace("/");
          }}
          className="mt-8 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="no-print mb-6 rounded-3xl border border-line bg-bg-elevated px-4 py-4 shadow-[var(--shadow)] sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="shrink-0 rounded-xl border border-line bg-white p-2.5 md:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm text-muted md:hidden">
                  {user.fullName} · {user.role}
                </p>
                <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-semibold sm:text-3xl">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
            </div>
          </div>
        </header>
        {children}
      </section>

      {menuOpen ? (
        <div className="no-print fixed inset-0 z-[75] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(85vw,20rem)] animate-[slideInLeft_0.25s_ease-out] flex-col bg-bg-elevated p-5 shadow-[var(--shadow)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">SMS</p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold">
                  School Desk
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {user.fullName} · {user.role}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
                className="rounded-xl border border-line p-2.5"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav className="mt-6 flex-1 space-y-1 overflow-y-auto">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={clsx(
                    "block rounded-xl px-3 py-3 text-sm font-semibold transition",
                    pathname === link.href || pathname.startsWith(link.href + "/")
                      ? "bg-brand text-white"
                      : "text-ink hover:bg-brand-soft"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
                router.replace("/");
              }}
              className="mt-4 w-full rounded-xl border border-line px-3 py-3 text-sm font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { dashboardPath };
