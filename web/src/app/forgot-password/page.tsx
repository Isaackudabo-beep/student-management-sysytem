"use client";

// Purpose: Forgot-password stub — email delivery not configured yet; points users to admin.
import Link from "next/link";
import { FormEvent, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const res = await api<{ success: true; data: { message: string } }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.data.message);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Request failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-line bg-bg-elevated p-8 shadow-[var(--shadow)]"
      >
        <Link href="/login" className="text-sm font-semibold text-brand">
          ← Back to portals
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Forgot password
        </h1>
        <p className="mt-2 text-muted">
          Email reset will be available once SMTP/Resend is configured. For now, ask an administrator
          to reset your password.
        </p>
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
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-brand">{message}</p> : null}
        <button type="submit" className="mt-6 w-full rounded-xl bg-brand py-3 font-semibold text-white">
          Submit
        </button>
      </form>
    </main>
  );
}
