"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, Stat } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

type TeacherDash = {
  counts: Record<string, number | null>;
  subjects?: Array<{ code: string; title: string; session: string; level?: string }>;
  classes?: string[];
  pending?: Array<{ enrollmentId: string; student: string; subject: string; className?: string }>;
  notifications?: Announcement[];
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherDash | null>(null);
  const [error, setError] = useState("");

  async function markRead(id: string) {
    await api(`/api/announcements/${id}/read`, { method: "POST" });
    const res = await api<{ success: true; data: TeacherDash }>("/api/dashboard");
    setData(res.data);
  }

  useEffect(() => {
    api<{ success: true; data: TeacherDash }>("/api/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load"));
  }, []);

  return (
    <AppShell title="Teacher Dashboard">
      {error ? <p className="text-danger">{error}</p> : null}
      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Assigned Subjects" value={data.counts.assignedSubjects ?? 0} />
            <Stat label="Pending Scores" value={data.counts.pendingScores ?? 0} />
            <Stat label="Scores Entered" value={data.counts.scoresEntered ?? 0} />
            <Stat label="Unread Notices" value={data.counts.unreadNotifications ?? 0} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Assigned subjects
              </h2>
              <ul className="mt-4 space-y-2">
                {(data.subjects ?? []).map((s) => (
                  <li key={`${s.code}-${s.session}`} className="flex justify-between border-b border-line py-2">
                    <span>
                      {s.code} — {s.title}
                    </span>
                    <span className="text-muted">{s.session}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-muted">
                Classes: {(data.classes ?? []).join(", ") || "None yet"}
              </p>
              <Link href="/scores" className="mt-4 inline-block font-semibold text-brand">
                Enter scores →
              </Link>
            </Card>

            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Recent notifications
              </h2>
              <ul className="mt-4 space-y-3">
                {(data.notifications ?? []).map((n) => (
                  <li key={n.id} className="border-b border-line pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-sm text-muted">{n.body}</p>
                      </div>
                      {!n.read ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand"
                          onClick={() => void markRead(n.id)}
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Pending scores
            </h2>
            <ul className="mt-4 space-y-2">
              {(data.pending ?? []).map((p) => (
                <li key={p.enrollmentId} className="flex justify-between border-b border-line py-2 text-sm">
                  <span>
                    {p.student} · {p.subject} · {p.className}
                  </span>
                  <span className="text-muted">Awaiting Result</span>
                </li>
              ))}
              {(data.pending ?? []).length === 0 ? (
                <li className="text-muted">No pending scores for your subjects.</li>
              ) : null}
            </ul>
          </Card>
        </>
      )}
    </AppShell>
  );
}
