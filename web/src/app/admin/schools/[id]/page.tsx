"use client";

// Purpose: View/edit one school + manage its administrators.
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Button, ErrorText, Input, Label } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";

type Detail = {
  id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED";
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  _count: { students: number; teachers: number; classes: number; subjects: number };
  admins: Array<{ id: string; fullName: string; email: string; mustChangePassword: boolean }>;
};

export default function AdminSchoolDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState({ name: "", address: "", phone: "", email: "" });
  const [adminForm, setAdminForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  async function load() {
    try {
      const res = await api<{ success: true; data: Detail }>(`/api/platform/schools/${id}`);
      setData(res.data);
      setEdit({
        name: res.data.name,
        address: res.data.address ?? "",
        phone: res.data.phone ?? "",
        email: res.data.email ?? "",
      });
      setError("");
    } catch (err) {
      setError(formatApiError(err, "Failed to load school"));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api(`/api/platform/schools/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: edit.name,
          address: edit.address || null,
          phone: edit.phone || null,
          email: edit.email || null,
        }),
      });
      setMessage("School information updated");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onAddAdmin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/platform/schools/${id}/admins`, {
        method: "POST",
        body: JSON.stringify(adminForm),
      });
      setAdminForm({ fullName: "", email: "", password: "" });
      setMessage("School admin created");
      await load();
    } catch (err) {
      setError(formatApiError(err, "Create admin failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperAdminShell title={data?.name ?? "School"}>
      <Link href="/admin/schools" className="mb-4 inline-block text-sm text-white/60 hover:text-white">
        ← All schools
      </Link>
      <ErrorText>{error}</ErrorText>
      {message ? <p className="mb-4 text-sm font-semibold text-[#7ec8c8]">{message}</p> : null}
      {!data ? (
        <p className="text-white/60">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#122833] p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              Edit school information
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {data.code} · {data.status} · {data._count.students} students · {data._count.teachers}{" "}
              teachers · {data._count.classes} classes · {data._count.subjects} subjects
            </p>
            <form onSubmit={onSave} className="mt-4 space-y-3">
              <div>
                <Label>School name</Label>
                <Input
                  value={edit.name}
                  onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                  className="bg-white text-ink placeholder:text-ink/40"
                  placeholder="Official school name"
                  required
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={edit.address}
                  onChange={(e) => setEdit({ ...edit, address: e.target.value })}
                  className="bg-white text-ink placeholder:text-ink/40"
                  placeholder="Street, city, state"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={edit.phone}
                  onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                  className="bg-white text-ink placeholder:text-ink/40"
                  placeholder="Contact phone"
                />
              </div>
              <div>
                <Label>Contact email</Label>
                <Input
                  type="email"
                  value={edit.email}
                  onChange={(e) => setEdit({ ...edit, email: e.target.value })}
                  className="bg-white text-ink placeholder:text-ink/40"
                  placeholder="school@example.com"
                />
              </div>
              <Button type="submit" loading={busy} className="bg-[#7ec8c8] text-[#0b1c24]">
                Save school info
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#122833] p-5">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
              School admins
            </h2>
            <ul className="mt-3 space-y-2">
              {data.admins.map((a) => (
                <li key={a.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                  <p className="font-semibold">{a.fullName}</p>
                  <p className="text-white/60">{a.email}</p>
                </li>
              ))}
              {data.admins.length === 0 ? (
                <li className="text-sm text-white/50">No admins yet</li>
              ) : null}
            </ul>
            <form onSubmit={onAddAdmin} className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <p className="text-sm font-semibold text-[#7ec8c8]">Add school administrator</p>
              <div>
                <Label>Full name</Label>
                <Input
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm({ ...adminForm, fullName: e.target.value })}
                  required
                  placeholder="Administrator full name"
                  className="bg-white text-ink placeholder:text-ink/40"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  placeholder="admin@school.edu"
                  className="bg-white text-ink placeholder:text-ink/40"
                />
              </div>
              <div>
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  className="bg-white text-ink placeholder:text-ink/40"
                />
              </div>
              <Button type="submit" loading={busy} className="bg-[#7ec8c8] text-[#0b1c24]">
                Add admin
              </Button>
            </form>
          </div>
        </div>
      )}
    </SuperAdminShell>
  );
}
