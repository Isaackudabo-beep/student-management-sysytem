"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, Stat } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

type AdminDash = {
  counts: Record<string, number | null>;
  gradeDistribution?: Array<{ grade: string; count: number }>;
  recentActivities?: Array<{ type: string; at: string; summary: string }>;
  quickActions?: Array<{ label: string; href: string }>;
  notifications?: Announcement[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ success: true; data: AdminDash }>("/api/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load"));
  }, []);

  return (
    <AppShell title="Admin Dashboard">
      {error ? <p className="text-danger">{error}</p> : null}
      {!data ? (
        <p className="text-muted">Loading statistics…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["students", "Total Students"],
              ["teachers", "Total Teachers"],
              ["subjects", "Total Subjects"],
              ["classes", "Total Classes"],
            ].map(([key, label]) => (
              <Stat key={key} label={label} value={data.counts[key] ?? "—"} />
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Quick actions
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(data.quickActions ?? []).map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                  >
                    {a.label}
                  </Link>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Notifications
              </h2>
              <ul className="mt-4 space-y-3">
                {(data.notifications ?? []).map((n) => (
                  <li key={n.id} className="border-b border-line pb-3">
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm text-muted">{n.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Recent activities
            </h2>
            <ul className="mt-4 space-y-2">
              {(data.recentActivities ?? []).map((a, idx) => (
                <li key={`${a.type}-${idx}`} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                  <span>{a.summary}</span>
                  <span className="shrink-0 text-muted">{new Date(a.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </AppShell>
  );
}
