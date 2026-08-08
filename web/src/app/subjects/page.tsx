"use client";

// Purpose: Subjects list + Admin create/delete.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Subject } from "@/lib/types";

export default function SubjectsPage() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    title: "",
    unit: "3",
    semester: "1",
    level: "SS2",
  });

  async function load(search = q) {
    try {
      const res = await api<{ success: true; data: Subject[] }>(
        `/api/subjects?q=${encodeURIComponent(search)}&limit=100`
      );
      setSubjects(res.data);
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
    setBusy(true);
    setError("");
    try {
      await api("/api/subjects", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          unit: Number(form.unit),
          semester: Number(form.semester),
          level: form.level,
        }),
      });
      setForm({ code: "", title: "", unit: "3", semester: "1", level: "SS2" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this subject?")) return;
    setDeletingId(id);
    setError("");
    try {
      await api(`/api/subjects/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AppShell title="Subjects">
      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input placeholder="Search code or title…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Button
            type="button"
            loading={searching}
            onClick={() => {
              setSearching(true);
              void load(q).finally(() => setSearching(false));
            }}
          >
            Search
          </Button>
        </div>
      </Card>

      {user?.role === "ADMIN" ? (
        <Card className="mb-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
            Add subject
          </h2>
          <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-5">
            {(["code", "title", "unit", "semester", "level"] as const).map((field) => (
              <div key={field}>
                <Label>{field}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  required
                />
              </div>
            ))}
            <div className="md:col-span-5">
              <Button type="submit" loading={busy}>
                Create subject
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-2 pr-4">Code</th>
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Unit</th>
                <th className="py-2 pr-4">Semester</th>
                <th className="py-2 pr-4">Level</th>
                {user?.role === "ADMIN" ? <th className="py-2">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id} className="border-b border-line/70">
                  <td className="py-3 pr-4 font-medium">{s.code}</td>
                  <td className="py-3 pr-4">{s.title}</td>
                  <td className="py-3 pr-4">{s.unit}</td>
                  <td className="py-3 pr-4">{s.semester}</td>
                  <td className="py-3 pr-4">{s.level}</td>
                  {user?.role === "ADMIN" ? (
                    <td className="py-3">
                      <Button
                        variant="danger"
                        loading={deletingId === s.id}
                        onClick={() => void onDelete(s.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
