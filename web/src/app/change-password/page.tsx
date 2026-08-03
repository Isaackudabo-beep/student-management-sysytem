"use client";

// Purpose: Forced / voluntary password change after admin reset.
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiRequestError } from "@/lib/api";
import { dashboardPath, useAuth } from "@/lib/auth";

export default function ChangePasswordPage() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: currentPassword || undefined,
          newPassword,
        }),
      });
      await refresh();
      if (user) router.replace(dashboardPath(user.role));
      else router.replace("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update password");
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
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">
          Change password
        </h1>
        <p className="mt-2 text-muted">
          {user?.mustChangePassword
            ? "An administrator reset your password. Choose a new one to continue."
            : "Update your account password."}
        </p>

        {!user?.mustChangePassword ? (
          <label className="mt-6 block text-sm font-medium">
            Current password
            <input
              className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
        ) : null}

        <label className="mt-4 block text-sm font-medium">
          New password
          <input
            className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none ring-brand focus:ring-2"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>

        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save password"}
        </button>

        <button
          type="button"
          className="mt-3 w-full text-sm font-semibold text-muted"
          onClick={() => {
            logout();
            router.replace("/");
          }}
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
