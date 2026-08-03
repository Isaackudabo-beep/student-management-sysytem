"use client";

// Purpose: Teachers list + Admin create + assign teacher to subject.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { Subject, Teacher } from "@/lib/types";

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "Password123!",
    department: "Computer Science",
    phone: "",
  });
  const [assign, setAssign] = useState({
    teacherId: "",
    subjectId: "",
    session: "2025/2026",
  });

  async function load() {
    try {
      const [t, s] = await Promise.all([
        api<{ success: true; data: Teacher[] }>("/api/teachers?limit=50"),
        api<{ success: true; data: Subject[] }>("/api/subjects?limit=100"),
      ]);
      setTeachers(t.data);
      setSubjects(s.data);
      if (!assign.teacherId && t.data[0]) {
        setAssign((a) => ({ ...a, teacherId: t.data[0].id }));
      }
      if (!assign.subjectId && s.data[0]) {
        setAssign((a) => ({ ...a, subjectId: s.data[0].id }));
      }
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/teachers", { method: "POST", body: JSON.stringify(form) });
      setMessage("Teacher created");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/teachers/assign-subject", {
        method: "POST",
        body: JSON.stringify(assign),
      });
      setMessage("Teacher assigned to subject");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Assign failed");
    }
  }

  return (
    <AppShell title="Teachers">
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Add teacher
          </h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3">
            {(["firstName", "lastName", "email", "phone", "department", "password"] as const).map(
              (field) => (
                <div key={field}>
                  <Label>{field}</Label>
                  <Input
                    value={form[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                    required={field !== "phone"}
                    type={field === "email" ? "email" : "text"}
                  />
                </div>
              )
            )}
            <Button type="submit">Create teacher</Button>
          </form>
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Assign subject
          </h2>
          <form onSubmit={onAssign} className="mt-4 grid gap-3">
            <div>
              <Label>Teacher</Label>
              <Select
                value={assign.teacherId}
                onChange={(e) => setAssign({ ...assign, teacherId: e.target.value })}
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.lastName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select
                value={assign.subjectId}
                onChange={(e) => setAssign({ ...assign, subjectId: e.target.value })}
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
                value={assign.session}
                onChange={(e) => setAssign({ ...assign, session: e.target.value })}
                required
              />
            </div>
            <Button type="submit">Assign</Button>
          </form>
        </Card>
      </div>

      {message ? <p className="mt-4 text-sm text-success">{message}</p> : null}
      <ErrorText>{error}</ErrorText>

      <Card className="mt-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Department</th>
                <th className="py-2 pr-4">Subjects</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b border-line/70">
                  <td className="py-3 pr-4">
                    {t.firstName} {t.lastName}
                  </td>
                  <td className="py-3 pr-4">{t.email}</td>
                  <td className="py-3 pr-4">{t.department}</td>
                  <td className="py-3 pr-4">
                    {(t.subjects ?? [])
                      .map((a) => `${a.subject.code} (${a.session})`)
                      .join(", ") || "—"}
                  </td>
                  <td className="py-3">
                    {t.user?.id ? (
                      <button
                        type="button"
                        className="text-brand"
                        onClick={async () => {
                          const temporaryPassword = prompt(
                            "Temporary password (min 8 chars)",
                            "Welcome123!"
                          );
                          if (!temporaryPassword) return;
                          try {
                            await api("/api/auth/admin/reset-password", {
                              method: "POST",
                              body: JSON.stringify({
                                userId: t.user!.id,
                                temporaryPassword,
                              }),
                            });
                            setMessage("Temporary password set — teacher must change it on next login");
                          } catch (err) {
                            setError(err instanceof ApiRequestError ? err.message : "Reset failed");
                          }
                        }}
                      >
                        Reset password
                      </button>
                    ) : null}
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
