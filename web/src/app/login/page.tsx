"use client";

// Purpose: Legacy /login redirects users to choose a role portal.
import Link from "next/link";

export default function LoginChooserPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-lg rounded-3xl border border-line bg-bg-elevated p-8 shadow-[var(--shadow)]">
        <Link href="/" className="text-sm font-semibold text-brand">
          ← Back
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold">
          Choose your portal
        </h1>
        <p className="mt-2 text-muted">Each role signs in through its own secure portal.</p>
        <div className="mt-8 grid gap-3">
          {[
            ["/login/admin", "Admin Login"],
            ["/login/teacher", "Teacher Login"],
            ["/login/student", "Student Login"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
