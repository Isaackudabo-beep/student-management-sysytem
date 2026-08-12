"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SuperAdminLoginPage() {
  const { login, user, loading, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role === "SUPER_ADMIN") {
      router.replace("/admin/dashboard");
      return;
    }
    // School-role sessions must not linger on the platform login page.
    logout();
  }, [loading, user, router, logout]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const signedIn = await login(email.trim(), password, "SUPER_ADMIN");
      if (signedIn.role !== "SUPER_ADMIN") {
        logout();
        setError("Unauthorized — Super Admin access only");
        return;
      }
      router.replace("/admin/dashboard");
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
          Super Admin
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Platform operators only. There is no public registration for this portal.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3" autoComplete="on">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="you@platform.email"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Your password"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <Button type="submit" loading={busy} className="w-full bg-accent">
            Sign in
          </Button>
          <ErrorText>{error}</ErrorText>
        </form>
      </div>
    </main>
  );
}
