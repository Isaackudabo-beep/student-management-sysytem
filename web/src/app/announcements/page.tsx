"use client";

// Purpose: Admin notifications — targeted audiences + history.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, ApiRequestError, formatApiError } from "@/lib/api";
import type { SchoolClass, Student, Teacher } from "@/lib/types";

type Row = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  expiresAt?: string | null;
  targetClass?: { name: string } | null;
  targetUser?: { fullName: string } | null;
  _count?: { reads: number };
};

export default function AnnouncementsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "ALL",
    targetClassId: "",
    targetUserId: "",
    expiresAt: "",
  });

  async function load() {
    try {
      const [a, c, s, t] = await Promise.all([
        api<{ success: true; data: Row[] }>("/api/announcements?limit=50"),
        api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100"),
        api<{ success: true; data: Student[] }>("/api/students?limit=100"),
        api<{ success: true; data: Teacher[] }>("/api/teachers?limit=100"),
      ]);
      setRows(a.data);
      setClasses(c.data);
      setStudents(s.data);
      setTeachers(t.data);
      setError("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          audience: form.audience,
          targetClassId: form.audience === "CLASS" ? form.targetClassId || null : null,
          targetUserId: form.audience === "USER" ? form.targetUserId || null : null,
          expiresAt: form.expiresAt || null,
        }),
      });
      setForm({
        title: "",
        body: "",
        audience: "ALL",
        targetClassId: "",
        targetUserId: "",
        expiresAt: "",
      });
      toast.success("Notification sent");
      await load();
    } catch (err) {
      const msg = formatApiError(err, "Create failed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await api(`/api/announcements/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Announcements">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Send notification
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Message</Label>
            <textarea
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3"
              rows={4}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Recipients</Label>
              <Select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="ALL">Entire school</option>
                <option value="STUDENTS">Students only</option>
                <option value="TEACHERS">Teachers only</option>
                <option value="ADMINS">Admins only</option>
                <option value="CLASS">Specific class</option>
                <option value="USER">Individual student or teacher</option>
              </Select>
            </div>
            <div>
              <Label>Expires (optional)</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
          </div>
          {form.audience === "CLASS" ? (
            <div>
              <Label>Class</Label>
              <Select
                value={form.targetClassId}
                onChange={(e) => setForm({ ...form, targetClassId: e.target.value })}
                required
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          {form.audience === "USER" ? (
            <div>
              <Label>Person</Label>
              <Select
                value={form.targetUserId}
                onChange={(e) => setForm({ ...form, targetUserId: e.target.value })}
                required
              >
                <option value="">Select person</option>
                <optgroup label="Students">
                  {students.map((s) => (
                    <option key={s.user?.id ?? s.id} value={s.user?.id}>
                      {s.firstName} {s.lastName} (Student)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Teachers">
                  {teachers.map((t) => (
                    <option key={t.user?.id ?? t.id} value={t.user?.id ?? t.userId}>
                      {t.firstName} {t.lastName} (Teacher)
                    </option>
                  ))}
                </optgroup>
              </Select>
            </div>
          ) : null}
          <Button type="submit" loading={busy}>
            Publish
          </Button>
        </form>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Card>
        <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-semibold">
          Notification history
        </h2>
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-line pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted">{r.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {r.audience}
                    {r.targetClass ? ` · ${r.targetClass.name}` : ""}
                    {r.targetUser ? ` · ${r.targetUser.fullName}` : ""} ·{" "}
                    {new Date(r.publishedAt).toLocaleString()} · {r._count?.reads ?? 0} reads
                  </p>
                </div>
                <button type="button" className="text-danger" onClick={() => void onDelete(r.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
