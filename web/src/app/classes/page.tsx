"use client";

// Purpose: Admin SchoolClass management (JSS1A–SS3) with clear level presets.
import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorText, Input, Label, Select, useToast } from "@/components/ui";
import { api, ApiRequestError, formatApiError } from "@/lib/api";
import type { SchoolClass } from "@/lib/types";

const LEVELS = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"] as const;

export default function ClassesPage() {
  const toast = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", level: "JSS1", arm: "A" });

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

  function syncName(level: string, arm: string) {
    const a = arm.trim().toUpperCase();
    return a ? `${level}${a}` : level;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const name = form.name.trim() || syncName(form.level, form.arm);
      await api("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          name,
          level: form.level,
          arm: form.arm.trim() || undefined,
        }),
      });
      setForm({ name: "", level: "JSS1", arm: "A" });
      toast.success(`Class ${name} created`);
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
    if (!confirm("Delete this class?")) return;
    setBusy(true);
    try {
      await api(`/api/classes/${id}`, { method: "DELETE" });
      toast.success("Class deleted");
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
    <AppShell title="Classes">
      <Card className="mb-6">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Add class</h2>
        <p className="mt-1 text-sm text-muted">
          Choose level (JSS1–SS3) and arm. Name defaults to Level+Arm (e.g. SS2B).
        </p>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <Label>Level</Label>
            <Select
              value={form.level}
              onChange={(e) => {
                const level = e.target.value;
                setForm({
                  ...form,
                  level,
                  name: syncName(level, form.arm),
                });
              }}
              required
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Arm</Label>
            <Input
              value={form.arm}
              onChange={(e) => {
                const arm = e.target.value;
                setForm({
                  ...form,
                  arm,
                  name: syncName(form.level, arm),
                });
              }}
              placeholder="A"
              maxLength={5}
            />
          </div>
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="SS2B"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={busy}>
              Create class
            </Button>
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
              <Button
                type="button"
                variant="danger"
                loading={busy}
                onClick={() => void onDelete(c.id)}
              >
                Delete
              </Button>
            </li>
          ))}
          {classes.length === 0 ? (
            <li className="py-4 text-sm text-muted">No classes yet — add JSS1–SS3 above.</li>
          ) : null}
        </ul>
      </Card>
    </AppShell>
  );
}
