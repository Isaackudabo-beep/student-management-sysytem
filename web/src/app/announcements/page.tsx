"use client";

// Purpose: Admin notification center — create and manage announcements.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";

type Row = {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
  expiresAt?: string | null;
  _count?: { reads: number };
};

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    body: "",
    audience: "ALL",
    expiresAt: "",
  });

  async function load() {
    try {
      const res = await api<{ success: true; data: Row[] }>("/api/announcements?limit=50");
      setRows(res.data);
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
    try {
      await api("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          audience: form.audience,
          expiresAt: form.expiresAt || null,
        }),
      });
      setForm({ title: "", body: "", audience: "ALL", expiresAt: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await api(`/api/announcements/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Announcements">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Post announcement
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
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
              <Label>Audience</Label>
              <Select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                <option value="ALL">Everyone</option>
                <option value="STUDENTS">Students</option>
                <option value="TEACHERS">Teachers</option>
                <option value="ADMINS">Admins</option>
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
          <Button type="submit">Publish</Button>
        </form>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Card>
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-line pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{r.title}</p>
                  <p className="mt-1 text-sm text-muted">{r.body}</p>
                  <p className="mt-2 text-xs text-muted">
                    {r.audience} · {new Date(r.publishedAt).toLocaleString()} · {r._count?.reads ?? 0} reads
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
