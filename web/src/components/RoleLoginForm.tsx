"use client";

// Purpose: Shared role login form — only the portal's expectedRole may sign in.
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { dashboardPath, useAuth } from "@/lib/auth";
import { ApiRequestError } from "@/lib/api";
import type { Role } from "@/lib/types";

const COPY: Record<Role, { title: string; blurb: string; demo: string }> = {
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
  const { login } = useAuth();
  const router = useRouter();
  const meta = COPY[role];
  const [email, setEmail] = useState(meta.demo);
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await login(email, password, role);
      router.replace(user.mustChangePassword ? "/change-password" : dashboardPath(user.role));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
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

        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          <Link href="/forgot-password" className="font-semibold text-brand">
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}
