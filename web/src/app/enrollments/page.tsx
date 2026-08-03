"use client";

// Purpose: Admin enrolls students into subjects for a session.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Enrollment, Student, Subject } from "@/lib/types";

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    studentId: "",
    subjectId: "",
    session: "2024/2025",
  });

  async function load() {
    try {
      const [e, st, su] = await Promise.all([
        api<{ success: true; data: Enrollment[] }>("/api/enrollments?limit=100"),
        api<{ success: true; data: Student[] }>("/api/students?limit=100"),
        api<{ success: true; data: Subject[] }>("/api/subjects?limit=100"),
      ]);
      setEnrollments(e.data);
      setStudents(st.data);
      setSubjects(su.data);
      setForm((f) => ({
        ...f,
        studentId: f.studentId || st.data[0]?.id || "",
        subjectId: f.subjectId || su.data[0]?.id || "",
      }));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/enrollments", { method: "POST", body: JSON.stringify(form) });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Enroll failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove enrollment?")) return;
    try {
      await api(`/api/enrollments/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Enrollments">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Register student for subject
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Student</Label>
            <Select
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.matricNumber} — {s.firstName} {s.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Subject</Label>
            <Select
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Session</Label>
            <Input
              value={form.session}
              onChange={(e) => setForm({ ...form, session: e.target.value })}
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Enroll
            </Button>
          </div>
        </form>
      </Card>

      <ErrorText>{error}</ErrorText>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">Student</th>
                <th className="py-2 pr-4">Subject</th>
                <th className="py-2 pr-4">Session</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((e) => (
                <tr key={e.id} className="border-b border-line/70">
                  <td className="py-3 pr-4">
                    {e.student.firstName} {e.student.lastName}
                  </td>
                  <td className="py-3 pr-4">{e.subject.code}</td>
                  <td className="py-3 pr-4">{e.session}</td>
                  <td className="py-3 pr-4">
                    {e.score ? `${e.score.total} (${e.score.grade})` : "Pending"}
                  </td>
                  <td className="py-3">
                    <Button variant="danger" onClick={() => void onDelete(e.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
