"use client";

// Purpose: Admin SchoolClass management (JSS1A, SS2B, etc.).
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import type { SchoolClass } from "@/lib/types";

export default function ClassesPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", level: "", arm: "" });

  async function load() {
    try {
      const res = await api<{ success: true; data: SchoolClass[] }>("/api/classes?limit=100");
      setClasses(res.data);
      setError("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to load classes");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/classes", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", level: "", arm: "" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this class?")) return;
    try {
      await api(`/api/classes/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    }
  }

  return (
    <AppShell title="Classes">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Add class</h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Name (e.g. SS2B)</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <Label>Level (e.g. SS2)</Label>
            <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} required />
          </div>
          <div>
            <Label>Arm</Label>
            <Input value={form.arm} onChange={(e) => setForm({ ...form, arm: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Card>
      <ErrorText>{error}</ErrorText>
      <Card>
        <ul className="space-y-2">
          {classes.map((c) => (
            <li key={c.id} className="flex items-center justify-between border-b border-line py-3">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted">
                  Level {c.level}
                  {c.arm ? ` · Arm ${c.arm}` : ""} · {c._count?.students ?? 0} students
                </p>
              </div>
              <button type="button" className="text-danger" onClick={() => void onDelete(c.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
