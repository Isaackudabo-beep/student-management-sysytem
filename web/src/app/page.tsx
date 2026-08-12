"use client";

// Purpose: Landing — three role portals for secondary school SMS.
import Link from "next/link";
import { dashboardPath, useAuth } from "@/lib/auth";
import { IconAdmin, IconStudentPortal, IconTeacherPortal } from "@/components/NavIcons";

const PORTALS = [
  {
    href: "/login/admin",
    label: "Admin Login",
    blurb: "Manage classes, teachers, and school records",
    Icon: IconAdmin,
  },
  {
    href: "/login/teacher",
    label: "Teacher Login",
    blurb: "Enter scores and view assigned subjects",
    Icon: IconTeacherPortal,
  },
  {
    href: "/login/student",
    label: "Student Login",
    blurb: "Check results and school announcements",
    Icon: IconStudentPortal,
  },
] as const;

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Loading…
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-brand">
        Secondary School Management
      </p>
      <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight text-ink md:text-6xl">
        Classes, subjects, scores, and results — built for real secondary schools.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        Separate portals for Admins, Teachers, and Students. Manage JSS/SS classes, enroll 5–11
        subjects, and publish school announcements.
      </p>

      {user ? (
        <div className="mt-8 max-w-xl rounded-2xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)]">
          <p className="text-sm text-muted">
            Signed in as <span className="font-semibold text-ink">{user.fullName}</span> ({user.role})
          </p>
          <Link
            href={user.mustChangePassword ? "/change-password" : dashboardPath(user.role)}
            className="mt-4 inline-flex rounded-xl bg-brand px-6 py-3 font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-110"
          >
            Continue to dashboard
          </Link>
        </div>
      ) : null}

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {PORTALS.map(({ href, label, blurb, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col items-center rounded-2xl border border-line bg-bg-elevated p-6 text-center shadow-[var(--shadow)] transition hover:border-brand/40 hover:shadow-md"
          >
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
              <Icon className="h-8 w-8 fill-none stroke-current stroke-2" />
            </span>
            <span className="mt-4 text-lg font-semibold text-ink">{label}</span>
            <span className="mt-1 text-sm text-muted">{blurb}</span>
            <span className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition group-hover:brightness-110">
              Sign in
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
