"use client";

// Purpose: Students list + Admin registration with class and 5–11 subject selection.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SchoolClass, Student, Subject } from "@/lib/types";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "Password123!",
  admissionNumber: "",
  phone: "",
  gender: "MALE",
  dateOfBirth: "2009-01-15",
  address: "",
  parentName: "",
  parentPhone: "",
  department: "Science",
  classId: "",
  session: "2025/2026",
};

export default function StudentsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId),
    [classes, form.classId]
  );

  async function load(search = q, pageNum = page) {
    try {
      const res = await api<{ success: true; data: Student[]; meta: { pages: number } }>(
        `/api/students?q=${encodeURIComponent(search)}&page=${pageNum}&limit=20`
      );
      setStudents(res.data);
      setPages(res.meta.pages || 1);
      setError("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load students");
    }
  }

  useEffect(() => {
    void load();
    api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100")
      .then((res) => setClasses(res.data))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setSubjects([]);
      setSelectedSubjects([]);
      return;
    }
    api<{ success: true; data: Subject[] }>(
      `/api/subjects?level=${encodeURIComponent(selectedClass.level)}&limit=100`
    )
      .then((res) => setSubjects(res.data))
      .catch((err) => setError(err.message));
  }, [selectedClass]);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (selectedSubjects.length < 5 || selectedSubjects.length > 11) {
      setError("Select between 5 and 11 subjects");
      return;
    }
    try {
      await api("/api/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          subjectIds: selectedSubjects,
        }),
      });
      setMessage("Student registered with subject enrollments");
      setForm(emptyForm);
      setSelectedSubjects([]);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    }
  }

  async function resetPassword(userId: string) {
    const temporaryPassword = prompt("Temporary password (min 8 chars)", "Welcome123!");
    if (!temporaryPassword) return;
    try {
      await api("/api/auth/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({ userId, temporaryPassword }),
      });
      setMessage("Temporary password set — user must change it on next login");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Reset failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this student?")) return;
    try {
      await api(`/api/students/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Students">
      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search name, email, admission no…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              setPage(1);
              void load(q, 1);
            }}
          >
            Search
          </Button>
        </div>
      </Card>

      {user?.role === "ADMIN" ? (
        <Card className="mb-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Register student
          </h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-2">
            {(
              [
                ["firstName", "First name"],
                ["lastName", "Last name"],
                ["email", "Email"],
                ["admissionNumber", "Admission number"],
                ["phone", "Phone"],
                ["address", "Address"],
                ["parentName", "Parent / Guardian name"],
                ["parentPhone", "Parent / Guardian phone"],
                ["department", "Stream / Department"],
                ["session", "Session"],
                ["password", "Temporary password"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <Label>{label}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                  type={field === "email" ? "email" : "text"}
                />
              </div>
            ))}
            <div>
              <Label>Gender</Label>
              <Select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label>Class</Label>
              <Select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value })}
                required
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.level})
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>
                Subjects for {selectedClass?.level ?? "class"} ({selectedSubjects.length}/5–11)
              </Label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedSubjects.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                    />
                    <span>
                      {s.code} — {s.title}
                    </span>
                  </label>
                ))}
                {selectedClass && subjects.length === 0 ? (
                  <p className="text-sm text-muted">No subjects for this class level yet.</p>
                ) : null}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Create student & enroll subjects</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>
      {message ? <p className="mb-4 text-sm text-brand">{message}</p> : null}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-2">Name</th>
              <th>Admission</th>
              <th>Class</th>
              <th>Subjects</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-line">
                <td className="py-3 font-semibold">
                  {s.firstName} {s.lastName}
                </td>
                <td>{s.admissionNumber}</td>
                <td>{s.schoolClass?.name ?? s.level}</td>
                <td>{s._count?.enrollments ?? "—"}</td>
                <td className="space-x-2">
                  {user?.role === "ADMIN" && s.user?.id ? (
                    <button
                      type="button"
                      className="text-brand"
                      onClick={() => void resetPassword(s.user!.id)}
                    >
                      Reset password
                    </button>
                  ) : null}
                  {user?.role === "ADMIN" ? (
                    <button type="button" className="text-danger" onClick={() => void onDelete(s.id)}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(q, next);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            disabled={page >= pages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(q, next);
            }}
          >
            Next
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
