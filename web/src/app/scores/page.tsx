"use client";

// Purpose: Teacher score entry + Admin/Teacher score listing.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Enrollment, Score } from "@/lib/types";

export default function ScoresPage() {
  const { user } = useAuth();
  const [scores, setScores] = useState<Score[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    enrollmentId: "",
    assessment: "30",
    exam: "45",
  });

  async function load() {
    try {
      const scoreRes = await api<{ success: true; data: Score[] }>("/api/scores?limit=100");
      setScores(scoreRes.data);

      if (user?.role === "TEACHER" || user?.role === "ADMIN") {
        const enr = await api<{ success: true; data: Enrollment[] }>(
          "/api/enrollments?limit=100"
        );
        const pending = enr.data.filter((e) => !e.score || user.role === "TEACHER");
        setEnrollments(enr.data);
        setForm((f) => ({
          ...f,
          enrollmentId: f.enrollmentId || pending[0]?.id || enr.data[0]?.id || "",
        }));
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/scores", {
        method: "POST",
        body: JSON.stringify({
          enrollmentId: form.enrollmentId,
          assessment: Number(form.assessment),
          exam: Number(form.exam),
        }),
      });
      setMessage("Score saved — total and grade computed on the server");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Save failed");
    }
  }

  return (
    <AppShell title="Scores">
      {user?.role === "TEACHER" ? (
        <Card className="mb-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Enter / update score
          </h2>
          <p className="mt-1 text-sm text-muted">
            Assessment /40 · Exam /60 · Grade calculated automatically.
          </p>
          <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Label>Enrollment</Label>
              <Select
                value={form.enrollmentId}
                onChange={(e) => setForm({ ...form, enrollmentId: e.target.value })}
              >
                {enrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.student.firstName} {e.student.lastName} — {e.subject.code} ({e.session})
                    {e.resultStatusLabel ? ` · ${e.resultStatusLabel}` : e.score ? " · Graded" : " · Awaiting Result"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Assessment (0-40)</Label>
              <Input
                type="number"
                min={0}
                max={40}
                value={form.assessment}
                onChange={(e) => setForm({ ...form, assessment: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Exam (0-60)</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={form.exam}
                onChange={(e) => setForm({ ...form, exam: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-4">
              <Button type="submit">Save score</Button>
            </div>
          </form>
          {message ? <p className="mt-3 text-sm text-success">{message}</p> : null}
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">CA</th>
                <th className="py-2 pr-4">Exam</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Grade</th>
                <th className="py-2">Remark</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s) => (
                <tr key={s.id} className="border-b border-line/70">
                  <td className="py-3 pr-4">
                    {s.enrollment?.student
                      ? `${s.enrollment.student.firstName} ${s.enrollment.student.lastName}`
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">{s.enrollment?.subject.code ?? "—"}</td>
                  <td className="py-3 pr-4">{s.assessment}</td>
                  <td className="py-3 pr-4">{s.exam}</td>
                  <td className="py-3 pr-4 font-semibold">{s.total}</td>
                  <td className="py-3 pr-4">{s.grade}</td>
                  <td className="py-3">{s.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
