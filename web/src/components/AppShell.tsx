"use client";

// Purpose: Auth gate + sidebar shell with role nav and forced password-change redirect.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { dashboardPath, loginPath, useAuth } from "@/lib/auth";
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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
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
      <aside className="hidden w-64 shrink-0 rounded-3xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)] md:block">
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
          onClick={() => {
            logout();
            router.replace(loginPath(user.role));
          }}
          className="mt-8 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold"
        >
          Sign out
        </button>
      </aside>

      <section className="min-w-0 flex-1">
        <header className="mb-6 rounded-3xl border border-line bg-bg-elevated px-6 py-5 shadow-[var(--shadow)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted md:hidden">
                {user.fullName} · {user.role}
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
                {title}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 md:hidden">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-line px-3 py-1 text-xs font-semibold"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

export { dashboardPath };
