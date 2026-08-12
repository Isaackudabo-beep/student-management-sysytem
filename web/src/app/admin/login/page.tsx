"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SuperAdminLoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@sms.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && user?.role === "SUPER_ADMIN") {
    router.replace("/admin");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password, "SUPER_ADMIN");
      router.replace("/admin");
    } catch (err) {
      setError(formatApiError(err, "Login failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#0b1c24] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#122a35] p-6 shadow-[var(--shadow)]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Platform</p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Super Admin login
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Manage schools across the platform. School staff use the normal portals.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white text-ink"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-white text-ink"
            />
          </div>
          <Button type="submit" loading={busy} className="w-full bg-accent">
            Sign in
          </Button>
          <ErrorText>{error}</ErrorText>
        </form>
        <Link href="/" className="mt-4 inline-block text-sm text-white/60 hover:text-white">
          ← Back to school portals
        </Link>
      </div>
    </main>
  );
}
