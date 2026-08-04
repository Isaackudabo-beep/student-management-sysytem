"use client";

// Purpose: Students list + Admin registration with class and 5–11 subject selection.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
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
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );

  const canSubmit =
    Boolean(form.classId) &&
    selectedSubjects.length >= 5 &&
    selectedSubjects.length <= 11 &&
    !subjectsLoading;

  async function load(search = q, pageNum = page) {
    try {
      const res = await api<{ success: true; data: Student[]; meta: { pages: number } }>(
        `/api/students?q=${encodeURIComponent(search)}&page=${pageNum}&limit=20`
      );
      setStudents(res.data);
      setPages(res.meta.pages || 1);
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load students"));
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
    setSelectedSubjects([]);

    if (!selectedClass) {
      setSubjects([]);
      setSubjectsLoading(false);
      return;
    }

    const level = selectedClass.level;
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjects([]);

    api<{ success: true; data: Subject[] }>(
      `/api/subjects?level=${encodeURIComponent(level)}&limit=100`
    )
      .then((res) => {
        if (cancelled) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setSubjects(rows);
        // Pre-select up to 6 so registration is not blocked by an empty checklist.
        setSelectedSubjects(rows.slice(0, Math.min(6, rows.length)).map((s) => s.id));
        if (rows.length === 0) {
          setError(`No subjects found for level ${level}. Add subjects for this level first.`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSubjects([]);
        setError(formatApiError(err, `Failed to load subjects for ${level}`));
      })
      .finally(() => {
        if (!cancelled) setSubjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass?.id, selectedClass?.level]);

  function toggleSubject(id: string) {
    setSelectedSubjects((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectRecommended() {
    setSelectedSubjects(subjects.slice(0, Math.min(6, subjects.length)).map((s) => s.id));
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!form.classId) {
      setError("Validation failed (classId)\nclassId: Select a class");
      return;
    }
    if (selectedSubjects.length < 5 || selectedSubjects.length > 11) {
      setError(
        `Validation failed (subjectIds)\nsubjectIds: Select between 5 and 11 subjects (currently ${selectedSubjects.length}). Choose a class, then tick subjects below.`
      );
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
      setSubjects([]);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Create failed"));
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
      setError(formatApiError(err, "Reset failed"));
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this student?")) return;
    try {
      await api(`/api/students/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Delete failed"));
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>
                  Subjects for {selectedClass?.level ?? "class"} ({selectedSubjects.length}/5–11
                  selected)
                </Label>
                {subjects.length > 0 ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-brand"
                    onClick={selectRecommended}
                  >
                    Select recommended (6)
                  </button>
                ) : null}
              </div>
              {!selectedClass ? (
                <p className="text-sm text-muted">Select a class to load matching subjects.</p>
              ) : subjectsLoading ? (
                <p className="text-sm text-muted">Loading subjects for {selectedClass.level}…</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {subjects.map((s) => {
                    const checked = selectedSubjects.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                          checked ? "border-brand bg-brand-soft" : "border-line"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--brand)]"
                          checked={checked}
                          onChange={() => toggleSubject(s.id)}
                        />
                        <span>
                          {s.code} — {s.title}
                        </span>
                      </label>
                    );
                  })}
                  {subjects.length === 0 ? (
                    <p className="text-sm text-muted">
                      No subjects for level {selectedClass.level}. Add them under Subjects first.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={!canSubmit}>
                Create student & enroll subjects
              </Button>
              {!canSubmit && selectedClass && !subjectsLoading ? (
                <p className="mt-2 text-sm text-muted">
                  Select between 5 and 11 subjects to enable create ({selectedSubjects.length}{" "}
                  selected).
                </p>
              ) : null}
              <ErrorText>{error}</ErrorText>
            </div>
          </form>
        </Card>
      ) : null}

      {!user || user.role !== "ADMIN" ? <ErrorText>{error}</ErrorText> : null}
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
