"use client";

// Purpose: Complete teacher management — avatar, CRUD, multi-subject assign, unassigned list.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar, Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, ApiRequestError, formatApiError } from "@/lib/api";
import type { Subject, Teacher } from "@/lib/types";

export default function TeachersPage() {
  const toast = useToast();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [unassigned, setUnassigned] = useState<Subject[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState("2025/2026");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "Password123!",
    department: "Sciences",
    phone: "",
  });
  const [assign, setAssign] = useState({
    teacherId: "",
    subjectIds: [] as string[],
  });
  const [pickSubject, setPickSubject] = useState<Subject | null>(null);
  const [assigningTeacherId, setAssigningTeacherId] = useState<string | null>(null);

  async function load() {
    setError("");
    const errors: string[] = [];

    try {
      const t = await api<{ success: true; data: Teacher[] }>("/api/teachers?limit=100");
      setTeachers(t.data);
      if (!assign.teacherId && t.data[0]) {
        setAssign((a) => ({ ...a, teacherId: t.data[0].id }));
      }
    } catch (err) {
      errors.push(formatApiError(err, "Failed to load teachers"));
    }

    try {
      const s = await api<{ success: true; data: Subject[] }>("/api/subjects?limit=100");
      setSubjects(s.data);
    } catch (err) {
      errors.push(formatApiError(err, "Failed to load subjects"));
    }

    try {
      const u = await api<{ success: true; data: Subject[] }>(
        `/api/teachers/unassigned-subjects?session=${encodeURIComponent(session)}`
      );
      setUnassigned(u.data);
    } catch (err) {
      errors.push(formatApiError(err, "Failed to load unassigned subjects"));
    }

    if (errors.length) setError(errors.join("\n"));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const editing = useMemo(
    () => teachers.find((t) => t.id === editingId) ?? null,
    [teachers, editingId]
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await api(`/api/teachers/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone || null,
            department: form.department,
          }),
        });
        toast.success("Teacher updated");
        setEditingId(null);
      } else {
        await api("/api/teachers", { method: "POST", body: JSON.stringify(form) });
        toast.success("Teacher created");
      }
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        password: "Password123!",
        department: "Sciences",
        phone: "",
      });
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Save failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    if (!assign.teacherId || assign.subjectIds.length === 0) {
      toast.error("Select a teacher and at least one subject");
      return;
    }
    setBusy(true);
    try {
      await api("/api/teachers/assign-subjects", {
        method: "POST",
        body: JSON.stringify({
          teacherId: assign.teacherId,
          subjectIds: assign.subjectIds,
          session,
        }),
      });
      toast.success("Subjects assigned");
      setAssign((a) => ({ ...a, subjectIds: [] }));
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Assign failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(assignmentId: string) {
    setBusy(true);
    try {
      await api(`/api/teachers/assignments/${assignmentId}`, { method: "DELETE" });
      toast.success("Subject removed");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this teacher?")) return;
    setBusy(true);
    try {
      await api(`/api/teachers/${id}`, { method: "DELETE" });
      toast.success("Teacher deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t: Teacher) {
    setEditingId(t.id);
    setForm({
      firstName: t.firstName,
      lastName: t.lastName,
      email: t.email,
      password: "",
      department: t.department,
      phone: t.phone ?? "",
    });
  }

  function toggleSubject(id: string) {
    setAssign((a) => ({
      ...a,
      subjectIds: a.subjectIds.includes(id)
        ? a.subjectIds.filter((x) => x !== id)
        : [...a.subjectIds, id],
    }));
  }

  async function assignSubjectToTeacher(subject: Subject, teacherId: string) {
    setAssigningTeacherId(teacherId);
    try {
      await api("/api/teachers/assign-subjects", {
        method: "POST",
        body: JSON.stringify({
          teacherId,
          subjectIds: [subject.id],
          session,
        }),
      });
      const teacher = teachers.find((t) => t.id === teacherId);
      toast.success(
        `${subject.code} assigned to ${teacher ? `${teacher.firstName} ${teacher.lastName}` : "teacher"}`
      );
      setPickSubject(null);
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Assign failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setAssigningTeacherId(null);
    }
  }

  return (
    <AppShell title="Teachers">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label>Session</Label>
          <Input value={session} onChange={(e) => setSession(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            {editing ? "Edit teacher" : "Add teacher"}
          </h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>First name</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            {!editing ? (
              <div className="sm:col-span-2">
                <Label>Temp password</Label>
                <Input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            ) : null}
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" loading={busy}>
                {editing ? "Save changes" : "Create teacher"}
              </Button>
              {editing ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditingId(null);
                    setForm({
                      firstName: "",
                      lastName: "",
                      email: "",
                      password: "Password123!",
                      department: "Sciences",
                      phone: "",
                    });
                  }}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Assign subjects
          </h2>
          <form onSubmit={onAssign} className="mt-4 space-y-3">
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
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-line p-3">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={assign.subjectIds.includes(s.id)}
                    onChange={() => toggleSubject(s.id)}
                  />
                  {s.code} — {s.title} ({s.level})
                </label>
              ))}
            </div>
            <Button type="submit" loading={busy}>
              Assign selected
            </Button>
          </form>
        </Card>
      </div>

      <ErrorText>{error}</ErrorText>

      <Card className="mt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Unassigned subjects ({session})
        </h2>
        <p className="mt-1 text-sm text-muted">
          Subjects not yet assigned to any teacher for this session. Click a subject to pick a teacher.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {unassigned.length === 0 ? (
            <li className="text-sm text-muted">All subjects are assigned.</li>
          ) : (
            unassigned.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setPickSubject(s)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left text-sm transition hover:border-brand hover:bg-brand-soft"
                >
                  <span>
                    <span className="font-semibold">{s.code}</span> · {s.title}
                    <span className="text-muted"> · {s.level}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-brand">Assign →</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </Card>

      {pickSubject ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          onClick={() => setPickSubject(null)}
        >
          <Card
            className="max-h-[85vh] w-full max-w-md overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">
                  Assign subject
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                  {pickSubject.code} · {pickSubject.title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {pickSubject.level} · {session}
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setPickSubject(null)}>
                Close
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted">Choose a teacher to assign this subject to:</p>
            <ul className="mt-3 space-y-2">
              {teachers.length === 0 ? (
                <li className="text-sm text-muted">No teachers available. Add a teacher first.</li>
              ) : (
                teachers.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      disabled={assigningTeacherId !== null}
                      onClick={() => void assignSubjectToTeacher(pickSubject, t.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2 text-left transition hover:border-brand hover:bg-brand-soft disabled:opacity-60"
                    >
                      <Avatar name={`${t.firstName} ${t.lastName}`} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {t.firstName} {t.lastName}
                        </span>
                        <span className="block truncate text-xs text-muted">{t.department}</span>
                      </span>
                      {assigningTeacherId === t.id ? (
                        <span
                          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand"
                          aria-hidden
                        />
                      ) : (
                        <span className="shrink-0 text-xs font-semibold text-brand">Select</span>
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>
      ) : null}

      <Card className="mt-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">All teachers</h2>
        <ul className="mt-4 divide-y divide-line">
          {teachers.map((t) => (
            <li key={t.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-3">
                <Avatar name={`${t.firstName} ${t.lastName}`} />
                <div>
                  <p className="font-semibold">
                    {t.firstName} {t.lastName}
                  </p>
                  <p className="text-sm text-muted">{t.email}</p>
                  <p className="text-sm text-muted">
                    {t.phone || "No phone"} · {t.department}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(t.subjects ?? []).map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-0.5 text-xs"
                      >
                        {a.subject.code} ({a.session})
                        <button
                          type="button"
                          className="text-danger"
                          disabled={busy}
                          onClick={() => void removeAssignment(a.id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {(t.subjects ?? []).length === 0 ? (
                      <span className="text-xs text-muted">No subjects assigned</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => startEdit(t)}>
                  Edit
                </Button>
                <Button type="button" variant="danger" loading={busy} onClick={() => void onDelete(t.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
