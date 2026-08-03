"use client";

// Purpose: Student-only results view — CA, Exam, Total, Grade, Remark or Awaiting Result.
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, ErrorText, Stat } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ResultRow = {
  id: string;
  session: string;
  subject: { code: string; title: string };
  score?: {
    assessment: number;
    exam: number;
    total: number;
    grade: string;
    remark: string;
  } | null;
  resultStatusLabel?: string;
  caScore?: number | null;
  examScore?: number | null;
};

type ResultsPayload = {
  enrollments: ResultRow[];
  summary: { enrolled: number; graded: number; awaiting?: number; average: number | null };
};

export default function ResultsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ResultsPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.studentId) return;
    api<{ success: true; data: ResultsPayload }>(`/api/scores/results/${user.studentId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof ApiRequestError ? err.message : "Failed"));
  }, [user]);

  return (
    <AppShell title="My Results">
      <ErrorText>{error}</ErrorText>
      {!data ? (
        <p className="text-muted">Loading results…</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Stat label="Enrolled subjects" value={data.summary.enrolled} />
            <Stat label="Graded subjects" value={data.summary.graded} />
            <Stat label="Awaiting Result" value={data.summary.awaiting ?? data.summary.enrolled - data.summary.graded} />
            <Stat label="Average" value={data.summary.average ?? "—"} />
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Session</th>
                    <th className="py-2 pr-4">CA</th>
                    <th className="py-2 pr-4">Exam</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Grade</th>
                    <th className="py-2 pr-4">Remark</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-line/70">
                      <td className="py-3 pr-4">
                        {e.subject.code} — {e.subject.title}
                      </td>
                      <td className="py-3 pr-4">{e.session}</td>
                      <td className="py-3 pr-4">{e.score?.assessment ?? e.caScore ?? "—"}</td>
                      <td className="py-3 pr-4">{e.score?.exam ?? e.examScore ?? "—"}</td>
                      <td className="py-3 pr-4">{e.score?.total ?? "—"}</td>
                      <td className="py-3 pr-4">{e.score?.grade ?? "—"}</td>
                      <td className="py-3 pr-4">{e.score?.remark ?? "—"}</td>
                      <td className="py-3">{e.resultStatusLabel ?? (e.score ? "Graded" : "Awaiting Result")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
