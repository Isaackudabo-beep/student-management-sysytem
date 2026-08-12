"use client";

// Purpose: Subjects list + Admin create/delete + senior stream packs.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, ApiRequestError, formatApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Subject } from "@/lib/types";

const LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;

export default function SubjectsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedingJunior, setSeedingJunior] = useState(false);
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    title: "",
    unit: "3",
    semester: "1",
    level: "SS2",
  });

  async function load(search = q, level = levelFilter) {
    try {
      const qs = new URLSearchParams({
        q: search,
        limit: "200",
        ...(level ? { level } : {}),
      });
      const res = await api<{ success: true; data: Subject[] }>(`/api/subjects?${qs}`);
      setSubjects(res.data);
      setError("");
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
      setForm({ code: "", title: "", unit: "3", semester: "1", level: form.level });
      toast.success("Subject created");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onEnsureJunior() {
    setSeedingJunior(true);
    setError("");
    try {
      const res = await api<{
        success: true;
        data: { message: string; created: number; skipped: number };
      }>("/api/subjects/ensure-junior", { method: "POST" });
      toast.success(res.data.message);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not add junior subjects"));
    } finally {
      setSeedingJunior(false);
    }
  }

  async function onEnsureStreams() {
    setSeeding(true);
    setError("");
    try {
      const res = await api<{
        success: true;
        data: { message: string; created: number; skipped: number };
      }>("/api/subjects/ensure-senior-streams", { method: "POST" });
      toast.success(res.data.message);
      await load();
    } catch (err) {
      setError(formatApiError(err, "Could not add stream subjects"));
    } finally {
      setSeeding(false);
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
          <Input
            placeholder="Search by code or title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              void load(q, e.target.value);
            }}
          >
            <option value="">All levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            loading={searching}
            onClick={() => {
              setSearching(true);
              void load(q, levelFilter).finally(() => setSearching(false));
            }}
          >
            Search
          </Button>
        </div>
      </Card>

      {user?.role === "ADMIN" ? (
        <Card className="mb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
                Add subject
              </h2>
              <p className="mt-1 text-sm text-muted">
                Use the buttons to fill missing junior (JSS1–JSS3) or senior stream (SS1–SS3) subjects.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={seedingJunior}
                onClick={() => void onEnsureJunior()}
              >
                Add junior subjects
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={seeding}
                onClick={() => void onEnsureStreams()}
              >
                Add Arts & Commercial packs
              </Button>
            </div>
          </div>
          <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-5">
            <div>
              <Label>Code</Label>
              <Input
                placeholder="e.g. LITS2"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Literature in English"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Level</Label>
              <Select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                required
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
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
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-muted">
                    No subjects found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
