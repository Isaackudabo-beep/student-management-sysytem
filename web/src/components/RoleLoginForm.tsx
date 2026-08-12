"use client";

// Purpose: Shared role login form — only the portal's expectedRole may sign in.
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardPath, schoolBrandName, useAuth } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import type { Role } from "@/lib/types";

const COPY: Record<Role, { title: string; blurb: string; demo: string }> = {
  SUPER_ADMIN: {
    title: "Platform Super Admin",
    blurb: "Create and manage schools across the platform.",
    demo: "superadmin@sms.local",
  },
  ADMIN: {
    title: "Admin Portal",
    blurb: "Manage classes, students, teachers, and school announcements.",
    demo: "admin@sms.local",
  },
  TEACHER: {
    title: "Teacher Portal",
    blurb: "Enter scores for your assigned subjects and classes.",
    demo: "teacher@sms.local",
  },
  STUDENT: {
    title: "Student Portal",
    blurb: "View your subjects, results, and school notices.",
    demo: "student@sms.local",
  },
};

export function RoleLoginForm({ role }: { role: Role }) {
  const { login, user, loading, logout } = useAuth();
  const router = useRouter();
  const meta = COPY[role];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const needsSchoolCode = role !== "SUPER_ADMIN";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const signedIn = await login(
        email,
        password,
        role,
        needsSchoolCode ? schoolCode || undefined : undefined
      );
      router.replace(
        signedIn.mustChangePassword ? "/change-password" : dashboardPath(signedIn.role)
      );
    } catch (err) {
      if (err instanceof ApiRequestError) {
        const needsCode =
          err.code === "SCHOOL_CODE_REQUIRED" ||
          /school code/i.test(err.message);
        setError(
          needsCode
            ? `${err.message} Use the school code from your administrator.`
            : err.message
        );
      } else if (err instanceof TypeError) {
        setError(
          `Cannot reach the API at ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}. Check that the backend is online.`
        );
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-muted">
        Loading…
      </main>
    );
  }

  if (user) {
    const brand = schoolBrandName(user);
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-line bg-bg-elevated p-8 shadow-[var(--shadow)]">
          <Link href="/" className="text-sm font-semibold text-brand">
            ← Back
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {user.schoolCode || "School"}
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            {brand}
          </h1>
          <p className="mt-1 text-sm font-semibold text-ink">{meta.title}</p>
          <p className="mt-2 text-muted">
            Signed in as {user.fullName} ({user.role}).
          </p>
          <Link
            href={user.mustChangePassword ? "/change-password" : dashboardPath(user.role)}
            className="mt-6 block w-full rounded-xl bg-brand py-3 text-center font-semibold text-white"
          >
            Continue to {brand}
          </Link>
          <button
            type="button"
            className="mt-3 w-full text-sm font-semibold text-muted"
            onClick={() => {
              logout();
              setEmail("");
              setPassword("");
              setSchoolCode("");
            }}
          >
            Sign out and use a different account
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-line bg-bg-elevated p-8 shadow-[var(--shadow)]"
      >
        <Link href="/" className="text-sm font-semibold text-brand">
          ← Back
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">
          {meta.title}
        </h1>
        <p className="mt-2 text-muted">{meta.blurb}</p>

        {needsSchoolCode ? (
          <label className="mt-6 block text-sm font-medium">
            School code
            <input
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
              placeholder="e.g. GREENFIELD (required if email is shared)"
              autoComplete="organization"
            />
          </label>
        ) : null}

        <label className={`block text-sm font-medium ${needsSchoolCode ? "mt-4" : "mt-6"}`}>
          Email
          <input
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={meta.demo}
            autoComplete="username"
            required
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm text-muted">
          Demo: {meta.demo} / Password123!
          {role === "ADMIN" ? " · school code DEFAULT" : null}
        </p>

        <p className="mt-2 text-center text-sm text-muted">
          <Link href="/forgot-password" className="font-semibold text-brand">
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}
