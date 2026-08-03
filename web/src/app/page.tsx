"use client";

// Purpose: Landing — three role portals for secondary school SMS.
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPath, useAuth } from "@/lib/auth";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.mustChangePassword ? "/change-password" : dashboardPath(user.role));
    }
  }, [loading, user, router]);

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
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {[
          ["/login/admin", "Admin Login"],
          ["/login/teacher", "Teacher Login"],
          ["/login/student", "Student Login"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl bg-brand px-6 py-3 text-center font-semibold text-white shadow-[var(--shadow)] transition hover:brightness-110"
          >
            {label}
          </Link>
        ))}
      </div>

      <section id="demo" className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          ["Admin", "admin@sms.local"],
          ["Teacher", "teacher@sms.local"],
          ["Student", "student@sms.local"],
        ].map(([role, email]) => (
          <div key={role} className="rounded-2xl border border-line bg-bg-elevated p-5 shadow-[var(--shadow)]">
            <p className="text-sm uppercase tracking-wide text-muted">{role}</p>
            <p className="mt-2 font-semibold">{email}</p>
            <p className="mt-1 text-sm text-muted">Password123!</p>
          </div>
        ))}
      </section>
    </main>
  );
}
