"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NAV_ICONS } from "@/components/NavIcons";
import { BarChart, Card, Stat } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

type AdminDash = {
  counts: Record<string, number | null>;
  charts?: {
    overallPassRate: number;
    passRateByClass: Array<{ className: string; passRate: number; scored: number }>;
    studentPopulation: Array<{ className: string; count: number }>;
    teacherCount: number;
  };
  gradeDistribution?: Array<{ grade: string; count: number }>;
  recentActivities?: Array<{ type: string; at: string; summary: string }>;
  quickActions?: Array<{ label: string; href: string }>;
  notifications?: Announcement[];
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDash | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function load() {
      attempts += 1;
      try {
        const res = await api<{ success: true; data: AdminDash }>("/api/dashboard");
        if (cancelled) return;
        setData(res.data);
        setError("");
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiRequestError ? err.message : "Failed to load";
        setError(message);
        // Auto-retry a few times while migrations settle after deploy.
        if (attempts < 5) {
          setLoading(true);
          window.setTimeout(() => {
            void load();
          }, 2500);
        } else {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell title="Admin Dashboard">
      {error ? <p className="text-danger">{error}</p> : null}
      {loading && !data ? (
        <p className="text-muted">Loading statistics…</p>
      ) : data ? (
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
                Overall school pass rate
              </h2>
              <p className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold text-brand">
                {data.charts?.overallPassRate ?? 0}%
              </p>
              <p className="mt-2 text-sm text-muted">Based on live scores (pass ≥ 40 total).</p>
            </Card>
            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Teacher count
              </h2>
              <p className="mt-4 font-[family-name:var(--font-display)] text-5xl font-semibold">
                {data.charts?.teacherCount ?? data.counts.teachers ?? 0}
              </p>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
                Pass rate by class
              </h2>
              <BarChart
                valueSuffix="%"
                items={(data.charts?.passRateByClass ?? []).map((c) => ({
                  label: c.className,
                  value: c.passRate,
                }))}
              />
            </Card>
            <Card>
              <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
                Student population
              </h2>
              <BarChart
                items={(data.charts?.studentPopulation ?? []).map((c) => ({
                  label: c.className,
                  value: c.count,
                }))}
              />
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Quick actions
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(data.quickActions ?? []).map((a) => {
                  const Icon =
                    NAV_ICONS[a.label] ||
                    Object.entries(NAV_ICONS).find(([k]) =>
                      a.label.toLowerCase().includes(k.toLowerCase())
                    )?.[1];
                  return (
                    <Link
                      key={a.href + a.label}
                      href={a.href}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
                    >
                      {Icon ? <Icon className="h-4 w-4 fill-none stroke-current stroke-2" /> : null}
                      {a.label}
                    </Link>
                  );
                })}
              </div>
            </Card>

            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Recent notifications
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
                <li
                  key={`${a.type}-${idx}`}
                  className="flex justify-between gap-4 border-b border-line py-2 text-sm"
                >
                  <span>{a.summary}</span>
                  <span className="shrink-0 text-muted">{new Date(a.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <p className="text-muted">Unable to load dashboard statistics.</p>
      )}
    </AppShell>
  );
}
