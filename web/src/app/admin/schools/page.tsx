"use client";

// Purpose: Super Admin school list, create, activate/suspend, search.
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { SchoolCodeBadge } from "@/components/SchoolCodeBadge";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Button, ErrorText, Input, Label, Select } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";

type SchoolRow = {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED";
  email?: string | null;
  adminCount: number;
  _count: { students: number; teachers: number; classes: number };
};

export default function AdminSchoolsPage() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });

  async function load(search = q, st = status) {
    try {
      const qs = new URLSearchParams({
        limit: "50",
        ...(search ? { q: search } : {}),
        ...(st ? { status: st } : {}),
      });
      const res = await api<{ success: true; data: SchoolRow[] }>(`/api/platform/schools?${qs}`);
      setRows(res.data);
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load schools"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/platform/schools", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          code: form.code || undefined,
          admin: {
            fullName: form.adminFullName,
            email: form.adminEmail,
            password: form.adminPassword,
          },
        }),
      });
      setForm({
        name: "",
        code: "",
        adminFullName: "",
        adminEmail: "",
        adminPassword: "",
      });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  async function setSchoolStatus(id: string, next: "ACTIVE" | "SUSPENDED") {
    setBusy(true);
    try {
      await api(`/api/platform/schools/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch (err) {
      setError(formatApiError(err, "Status update failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperAdminShell title="Schools">
      <div className="mb-6 rounded-3xl border border-white/10 bg-[#122833] p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          Create school
        </h2>
        <form onSubmit={onCreate} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>School name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="e.g. Greenfield Secondary School"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Code (optional)</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="Auto-generated if blank"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Admin full name</Label>
            <Input
              value={form.adminFullName}
              onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
              required
              placeholder="School administrator name"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Admin email</Label>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              required
              placeholder="admin@school.edu"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Admin temp password</Label>
            <Input
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={busy} className="bg-[#7ec8c8] text-[#0b1c24]">
              Create school + admin
            </Button>
          </div>
        </form>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search by name or code…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="bg-white text-ink placeholder:text-ink/40"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-white text-ink"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
        <Button
          type="button"
          loading={busy}
          onClick={() => void load(q, status)}
          className="bg-[#7ec8c8] text-[#0b1c24]"
        >
          Search
        </Button>
      </div>

      <ErrorText>{error}</ErrorText>

      <ul className="space-y-3">
        {rows.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[#122833] p-5 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/60">
                <span>Login code:</span>
                <SchoolCodeBadge code={s.code} />
              </p>
              <p className="mt-1 text-sm text-white/60">
                {s.status} · {s._count.students} students · {s._count.teachers} teachers ·{" "}
                {s.adminCount} admins
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/schools/${s.id}`}>
                <Button type="button" className="bg-[#7ec8c8] text-[#0b1c24]">
                  Edit info
                </Button>
              </Link>
              <Link href={`/admin/schools/${s.id}`}>
                <Button type="button" variant="secondary">
                  View
                </Button>
              </Link>
              {s.status === "ACTIVE" ? (
                <Button
                  type="button"
                  variant="danger"
                  loading={busy}
                  onClick={() => void setSchoolStatus(s.id, "SUSPENDED")}
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  type="button"
                  loading={busy}
                  className="bg-[#7ec8c8] text-[#0b1c24]"
                  onClick={() => void setSchoolStatus(s.id, "ACTIVE")}
                >
                  Activate
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </SuperAdminShell>
  );
}
