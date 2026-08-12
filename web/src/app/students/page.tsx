"use client";

// Purpose: Students list + Admin registration with class and 5–11 subject selection.
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SchoolClass, Student, Subject } from "@/lib/types";
import { STREAM_OPTIONS, subjectMatchesDepartment } from "@/lib/subjectStreams";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  admissionNumber: "",
  phone: "",
  gender: "MALE",
  dateOfBirth: "",
  address: "",
  parentName: "",
  parentPhone: "",
  department: "Science",
  classId: "",
  session: "2025/2026",
};

export default function StudentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [listBusy, setListBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [profile, setProfile] = useState<Student | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );

  const canSubmit =
    Boolean(form.classId) &&
    selectedSubjects.length >= 5 &&
    selectedSubjects.length <= 11 &&
    !subjectsLoading;

  async function load(search = q, pageNum = page, classId = classFilter) {
    setListBusy(true);
    try {
      const qs = new URLSearchParams({
        q: search,
        page: String(pageNum),
        limit: "20",
        ...(classId ? { classId } : {}),
      });
      const res = await api<{ success: true; data: Student[]; meta: { pages: number } }>(
        `/api/students?${qs}`
      );
      setStudents(res.data);
      setPages(res.meta.pages || 1);
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load students"));
    } finally {
      setListBusy(false);
    }
  }

  async function openProfile(id: string) {
    setProfileBusy(true);
    try {
      const res = await api<{ success: true; data: Student }>(`/api/students/${id}`);
      setProfile(res.data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load profile"));
    } finally {
      setProfileBusy(false);
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
    const isSenior = /^SS/i.test(level);
    let cancelled = false;
    setSubjectsLoading(true);
    setSubjects([]);

    api<{ success: true; data: Subject[] }>(
      `/api/subjects?level=${encodeURIComponent(level)}&limit=200`
    )
      .then((res) => {
        if (cancelled) return;
        let rows = Array.isArray(res.data) ? res.data : [];
        if (isSenior) {
          rows = rows.filter((s) => subjectMatchesDepartment(s.code, form.department));
        }
        setSubjects(rows);
        setSelectedSubjects(rows.slice(0, Math.min(6, rows.length)).map((s) => s.id));
        if (rows.length === 0) {
          setError(
            `No subjects found for ${level}${isSenior ? ` / ${form.department}` : ""}. Add subjects under Subjects (use Add Arts & Commercial packs for senior streams).`
          );
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
  }, [selectedClass?.id, selectedClass?.level, form.department]);

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
    setBusy(true);
    try {
      await api("/api/students", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          subjectIds: selectedSubjects,
          term: "FIRST",
        }),
      });
      setMessage("Student registered with subject enrollments");
      toast.success("Student created");
      setForm(emptyForm);
      setSelectedSubjects([]);
      setSubjects([]);
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Create failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
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
    setBusy(true);
    try {
      await api(`/api/students/${id}`, { method: "DELETE" });
      toast.success("Student deleted");
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Delete failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
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
          <Select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
              void load(q, 1, e.target.value);
            }}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            loading={listBusy}
            onClick={() => {
              setPage(1);
              void load(q, 1, classFilter);
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
                ["firstName", "First name", "e.g. Ada"],
                ["lastName", "Last name", "e.g. Okeke"],
                ["email", "Email", "student@school.edu"],
                ["admissionNumber", "Admission number", "e.g. ADM/SS2/012"],
                ["phone", "Phone", "080…"],
                ["address", "Address", "Home address"],
                ["parentName", "Parent / Guardian name", "Guardian full name"],
                ["parentPhone", "Parent / Guardian phone", "080…"],
                ["session", "Session", "2025/2026"],
                ["password", "Temporary password", "Min. 8 characters"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <div key={field}>
                <Label>{label}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                  type={field === "email" ? "email" : field === "password" ? "password" : "text"}
                  placeholder={placeholder}
                  minLength={field === "password" ? 8 : undefined}
                />
              </div>
            ))}
            <div>
              <Label>Stream / Department</Label>
              <Select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                required
              >
                {STREAM_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-muted">
                Senior subjects filter to this stream (Arts / Commercial / Science).
              </p>
            </div>
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
              {classes.length === 0 ? (
                <p className="text-sm text-muted">No classes yet. Create classes first.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2" role="listbox" aria-label="Select class">
                  {classes.map((c) => {
                    const active = form.classId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => setForm({ ...form, classId: c.id })}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "border-brand bg-brand text-white"
                            : "border-line bg-white text-ink hover:border-brand/50"
                        }`}
                      >
                        {c.name}
                        <span className={active ? "opacity-80" : "text-muted"}> ({c.level})</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!form.classId ? (
                <p className="mt-2 text-sm text-muted">Tap a class to load matching subjects.</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <Label>
                  Subjects for {selectedClass?.level ?? "class"}
                  {selectedClass && /^SS/i.test(selectedClass.level)
                    ? ` · ${form.department}`
                    : ""}{" "}
                  ({selectedSubjects.length}/5–11 selected)
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
                      No subjects for {selectedClass.level}
                      {/^SS/i.test(selectedClass.level) ? ` / ${form.department}` : ""}. Open
                      Subjects and use “Add Arts & Commercial packs”.
                    </p>
                  ) : null}
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={!canSubmit} loading={busy}>
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
                  <button
                    type="button"
                    className="text-left text-brand hover:underline"
                    onClick={() => void openProfile(s.id)}
                  >
                    {s.firstName} {s.lastName}
                  </button>
                  {s.academicStatus === "REPEATING" ? (
                    <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">
                      Repeated
                    </span>
                  ) : null}
                </td>
                <td>{s.admissionNumber}</td>
                <td>{s.schoolClass?.name ?? s.level}</td>
                <td>{s._count?.enrollments ?? "—"}</td>
                <td className="space-x-2">
                  <button
                    type="button"
                    className="text-brand"
                    onClick={() => void openProfile(s.id)}
                  >
                    Profile
                  </button>
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
            loading={listBusy}
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(q, next, classFilter);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            loading={listBusy}
            disabled={page >= pages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(q, next, classFilter);
            }}
          >
            Next
          </Button>
        </div>
      </Card>

      {profile || profileBusy ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
                Student profile
              </h2>
              <Button type="button" variant="secondary" onClick={() => setProfile(null)}>
                Close
              </Button>
            </div>
            {profileBusy || !profile ? (
              <p className="mt-4 text-muted">Loading profile…</p>
            ) : (
              <div className="mt-4 space-y-6">
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Personal information
                  </h3>
                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">Name</dt>
                      <dd className="font-semibold">
                        {profile.firstName} {profile.lastName}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Admission</dt>
                      <dd className="font-semibold">{profile.admissionNumber}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Class</dt>
                      <dd className="font-semibold">
                        {profile.classDisplay ?? profile.schoolClass?.name ?? profile.level}
                        {profile.academicStatusLabel === "Repeated" ? (
                          <span className="ml-2 text-danger">Repeated</span>
                        ) : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Email / Phone</dt>
                      <dd className="font-semibold">
                        {profile.email} · {profile.phone}
                      </dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-muted">Address</dt>
                      <dd className="font-semibold">{profile.address}</dd>
                    </div>
                  </dl>
                </section>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Parent / Guardian
                  </h3>
                  <p className="mt-2 text-sm font-semibold">
                    {profile.parentName} · {profile.parentPhone}
                  </p>
                </section>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Current results
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(profile.enrollments ?? []).map((e) => (
                      <li key={e.id} className="flex justify-between border-b border-line py-1">
                        <span>
                          {e.subject.code} ({e.session}
                          {e.term ? ` · ${e.term}` : ""})
                        </span>
                        <span className="font-semibold">
                          {e.score ? `${e.score.total} (${e.score.grade})` : "Awaiting"}
                        </span>
                      </li>
                    ))}
                    {(profile.enrollments ?? []).length === 0 ? (
                      <li className="text-muted">No current enrollments</li>
                    ) : null}
                  </ul>
                </section>
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Previous (archived) results
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm">
                    {(profile.archivedResults ?? []).map((a) => (
                      <li key={a.id} className="flex justify-between border-b border-line py-1">
                        <span>
                          {a.subjectCode} ({a.session} · {a.term}) · {a.className}
                        </span>
                        <span className="font-semibold">
                          {a.total} ({a.grade})
                        </span>
                      </li>
                    ))}
                    {(profile.archivedResults ?? []).length === 0 ? (
                      <li className="text-muted">No archived results</li>
                    ) : null}
                  </ul>
                </section>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </AppShell>
  );
}
