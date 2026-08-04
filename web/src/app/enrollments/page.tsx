"use client";

// Purpose: Admin enrolls students into subjects for a session.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import type { Enrollment, Student, Subject } from "@/lib/types";

const CURRENT_SESSION = "2025/2026";

export default function EnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    studentId: "",
    subjectId: "",
    session: CURRENT_SESSION,
  });

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === form.studentId),
    [students, form.studentId]
  );

  const matchingSubjects = useMemo(() => {
    if (!selectedStudent) return [];
    return subjects.filter(
      (s) => s.level.toUpperCase() === selectedStudent.level.toUpperCase()
    );
  }, [subjects, selectedStudent]);

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
      setForm((f) => {
        const studentId = f.studentId || st.data[0]?.id || "";
        const student = st.data.find((s) => s.id === studentId) ?? st.data[0];
        const levelSubjects = student
          ? su.data.filter((s) => s.level.toUpperCase() === student.level.toUpperCase())
          : [];
        const subjectStillValid = levelSubjects.some((s) => s.id === f.subjectId);
        return {
          ...f,
          studentId,
          subjectId: subjectStillValid ? f.subjectId : levelSubjects[0]?.id || "",
          session: f.session || CURRENT_SESSION,
        };
      });
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    const levelSubjects = subjects.filter(
      (s) => s.level.toUpperCase() === selectedStudent.level.toUpperCase()
    );
    setForm((f) => {
      if (levelSubjects.some((s) => s.id === f.subjectId)) return f;
      return { ...f, subjectId: levelSubjects[0]?.id || "" };
    });
  }, [selectedStudent, subjects]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!form.studentId || !form.subjectId) {
      setError("Select a student and a subject that matches their class level");
      return;
    }
    try {
      await api("/api/enrollments", { method: "POST", body: JSON.stringify(form) });
      setMessage("Student enrolled in subject");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Enroll failed"));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Remove enrollment?")) return;
    setError("");
    try {
      await api(`/api/enrollments/${id}`, { method: "DELETE" });
      setMessage("Enrollment removed");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Delete failed"));
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
                  {s.admissionNumber} — {s.firstName} {s.lastName} ({s.level})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Subject{selectedStudent ? ` (${selectedStudent.level})` : ""}</Label>
            <Select
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              {matchingSubjects.length === 0 ? (
                <option value="">No subjects for this level</option>
              ) : (
                matchingSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.title}
                  </option>
                ))
              )}
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
            <Button type="submit" className="w-full" disabled={!form.subjectId}>
              Enroll
            </Button>
          </div>
        </form>
        {selectedStudent && matchingSubjects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No subjects exist for level {selectedStudent.level}. Add them under Subjects first.
          </p>
        ) : null}
      </Card>

      <ErrorText>{error}</ErrorText>
      {message ? <p className="mb-4 text-sm text-brand">{message}</p> : null}

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
