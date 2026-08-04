"use client";

// Purpose: Teacher score entry + Admin/Teacher score listing.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Enrollment, Score } from "@/lib/types";

export default function ScoresPage() {
  const { user } = useAuth();
  const [scores, setScores] = useState<Score[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [form, setForm] = useState({
    enrollmentId: "",
    assessment: "30",
    exam: "45",
  });

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; code: string; title: string }>();
    for (const e of enrollments) {
      if (!e.subject) continue;
      map.set(e.subject.id, {
        id: e.subject.id,
        code: e.subject.code,
        title: e.subject.title,
      });
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [enrollments]);

  const filteredEnrollments = useMemo(() => {
    const rows = subjectFilter
      ? enrollments.filter((e) => e.subject?.id === subjectFilter)
      : enrollments;

    return [...rows].sort((a, b) => {
      const awaitA = a.score ? 1 : 0;
      const awaitB = b.score ? 1 : 0;
      if (awaitA !== awaitB) return awaitA - awaitB;
      const nameA = `${a.student?.lastName ?? ""} ${a.student?.firstName ?? ""}`;
      const nameB = `${b.student?.lastName ?? ""} ${b.student?.firstName ?? ""}`;
      return nameA.localeCompare(nameB);
    });
  }, [enrollments, subjectFilter]);

  const selectedEnrollment = useMemo(
    () => enrollments.find((e) => e.id === form.enrollmentId) ?? null,
    [enrollments, form.enrollmentId]
  );

  async function load() {
    try {
      const scoreRes = await api<{ success: true; data: Score[] }>("/api/scores?limit=100");
      setScores(scoreRes.data);
      setError("");

      if (user?.role === "TEACHER" || user?.role === "ADMIN") {
        const enr = await api<{ success: true; data: Enrollment[] }>(
          "/api/enrollments?limit=100"
        );
        const rows = Array.isArray(enr.data) ? enr.data : [];
        setEnrollments(rows);

        setForm((f) => {
          const stillValid = rows.some((e) => e.id === f.enrollmentId);
          if (stillValid) return f;
          const awaiting = rows.find((e) => !e.score);
          return { ...f, enrollmentId: awaiting?.id || rows[0]?.id || "" };
        });

        setSubjectFilter((prev) => {
          if (prev && rows.some((e) => e.subject?.id === prev)) return prev;
          return "";
        });
      }
    } catch (err) {
      setError(formatApiError(err, "Failed to load"));
    }
  }

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  useEffect(() => {
    if (!form.enrollmentId) return;
    if (filteredEnrollments.some((e) => e.id === form.enrollmentId)) return;
    const next = filteredEnrollments.find((e) => !e.score) ?? filteredEnrollments[0];
    setForm((f) => ({ ...f, enrollmentId: next?.id || "" }));
  }, [filteredEnrollments, form.enrollmentId]);

  function onPickEnrollment(enrollmentId: string) {
    const row = enrollments.find((e) => e.id === enrollmentId);
    setForm({
      enrollmentId,
      assessment: row?.score ? String(row.score.assessment) : "30",
      exam: row?.score ? String(row.score.exam) : "45",
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!form.enrollmentId) {
      setError("Select a student enrollment first");
      return;
    }
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
      setError(formatApiError(err, "Save failed"));
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

          {enrollments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No enrollments in your assigned subjects yet. Ask an admin to enroll students or
              assign you to subjects.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-4">
              <div>
                <Label>Subject</Label>
                <Select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                >
                  <option value="">All subjects ({enrollments.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="md:col-span-3">
                <Label>Student enrollment</Label>
                <Select
                  value={form.enrollmentId}
                  onChange={(e) => onPickEnrollment(e.target.value)}
                >
                  {filteredEnrollments.length === 0 ? (
                    <option value="">No students for this subject</option>
                  ) : (
                    filteredEnrollments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.student?.firstName} {e.student?.lastName}
                        {e.student?.schoolClass?.name ? ` · ${e.student.schoolClass.name}` : ""}
                        {" — "}
                        {e.subject?.code}
                        {e.score ? " · Graded" : " · Awaiting Result"}
                      </option>
                    ))
                  )}
                </Select>
                {selectedEnrollment ? (
                  <p className="mt-2 text-sm text-muted">
                    {selectedEnrollment.student?.firstName}{" "}
                    {selectedEnrollment.student?.lastName} · {selectedEnrollment.subject?.title} ·{" "}
                    {selectedEnrollment.session}
                    {selectedEnrollment.score
                      ? ` · current ${selectedEnrollment.score.total} (${selectedEnrollment.score.grade})`
                      : " · no score yet"}
                  </p>
                ) : null}
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
              <div className="flex items-end md:col-span-2">
                <Button type="submit" disabled={!form.enrollmentId} className="w-full md:w-auto">
                  Save score
                </Button>
              </div>
            </form>
          )}
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
              {scores.length === 0 ? (
                <tr>
                  <td className="py-4 text-muted" colSpan={7}>
                    No scores to show yet.
                  </td>
                </tr>
              ) : (
                scores.map((s) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
