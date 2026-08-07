"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, Stat } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Announcement } from "@/lib/types";

type StudentDash = {
  profile?: {
    fullName: string;
    admissionNumber: string;
    className: string | null;
    level: string;
    academicStatus?: string;
    academicStatusLabel?: string;
    phone: string;
    parentName: string;
    parentPhone: string;
    address: string;
    gender: string;
  } | null;
  counts: Record<string, number | null>;
  subjects?: Array<{
    code: string;
    title: string;
    session: string;
    resultStatusLabel: string;
    assessment: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
    remark: string | null;
  }>;
  academicSummary?: { average: number | null; graded: number; awaiting: number };
  notifications?: Announcement[];
};

export default function StudentDashboardPage() {
  const [data, setData] = useState<StudentDash | null>(null);
  const [error, setError] = useState("");

  async function markRead(id: string) {
    await api(`/api/announcements/${id}/read`, { method: "POST" });
    const res = await api<{ success: true; data: StudentDash }>("/api/dashboard");
    setData(res.data);
  }

  useEffect(() => {
    api<{ success: true; data: StudentDash }>("/api/dashboard")
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed to load"));
  }, []);

  return (
    <AppShell title="Student Dashboard">
      {error ? <p className="text-danger">{error}</p> : null}
      {!data ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Subjects" value={data.counts.enrolledSubjects ?? 0} />
            <Stat label="Graded" value={data.counts.gradedSubjects ?? 0} />
            <Stat label="Awaiting Result" value={data.counts.awaitingResults ?? 0} />
            <Stat label="Average" value={data.counts.average ?? "—"} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Personal information
              </h2>
              {data.profile ? (
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-4 border-b border-line py-2">
                    <dt className="text-muted">Name</dt>
                    <dd className="font-semibold">{data.profile.fullName}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-line py-2">
                    <dt className="text-muted">Admission No.</dt>
                    <dd className="font-semibold">{data.profile.admissionNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-line py-2">
                    <dt className="text-muted">Class</dt>
                    <dd className="font-semibold">
                      {data.profile.className}
                      {data.profile.academicStatusLabel === "Repeated" ? (
                        <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                          Repeated
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-line py-2">
                    <dt className="text-muted">Parent / Guardian</dt>
                    <dd className="font-semibold">
                      {data.profile.parentName} ({data.profile.parentPhone})
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-line py-2">
                    <dt className="text-muted">Address</dt>
                    <dd className="max-w-[60%] text-right font-semibold">{data.profile.address}</dd>
                  </div>
                </dl>
              ) : null}
            </Card>

            <Card>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Notifications
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

          <Card className="mt-6 overflow-x-auto">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Registered subjects & results
            </h2>
            <table className="mt-4 w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2">Subject</th>
                  <th>CA</th>
                  <th>Exam</th>
                  <th>Total</th>
                  <th>Grade</th>
                  <th>Remark</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.subjects ?? []).map((s) => (
                  <tr key={`${s.code}-${s.session}`} className="border-b border-line">
                    <td className="py-3 font-semibold">
                      {s.code} — {s.title}
                    </td>
                    <td>{s.assessment ?? "—"}</td>
                    <td>{s.exam ?? "—"}</td>
                    <td>{s.total ?? "—"}</td>
                    <td>{s.grade ?? "—"}</td>
                    <td>{s.remark ?? "—"}</td>
                    <td>{s.resultStatusLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
