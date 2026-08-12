"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Button, Card, ErrorText, Input, Label } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";

export default function CreateSchoolPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    code: "",
    address: "",
    phone: "",
    email: "",
    adminFullName: "",
    adminEmail: "",
    adminPassword: "",
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api<{ success: true; data: { school: { id: string } } }>(
        "/api/platform/schools",
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            code: form.code || undefined,
            address: form.address || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
            admin: form.adminEmail
              ? {
                  fullName: form.adminFullName || "School Admin",
                  email: form.adminEmail,
                  password: form.adminPassword,
                }
              : undefined,
          }),
        }
      );
      router.replace(`/admin/schools/${res.data.school.id}`);
    } catch (err) {
      setError(formatApiError(err, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SuperAdminShell title="Create school">
      <Card className="max-w-2xl border-white/10 bg-[#122a35] text-white">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>School name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Greenfield Secondary School"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Code (optional)</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="bg-white text-ink placeholder:text-ink/40"
              placeholder="Auto from name if blank"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="School phone"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street, city, state"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>School contact email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="info@school.edu"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="sm:col-span-2 mt-2 border-t border-white/10 pt-4">
            <p className="text-sm font-semibold text-accent">School administrator (optional)</p>
          </div>
          <div>
            <Label>Admin full name</Label>
            <Input
              value={form.adminFullName}
              onChange={(e) => setForm({ ...form, adminFullName: e.target.value })}
              placeholder="Administrator full name"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div>
            <Label>Admin email</Label>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              placeholder="admin@school.edu"
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Temp password</Label>
            <Input
              type="password"
              value={form.adminPassword}
              onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
              placeholder="Min. 8 characters (required if email set)"
              minLength={8}
              className="bg-white text-ink placeholder:text-ink/40"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} className="bg-accent">
              Create school
            </Button>
          </div>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>
    </SuperAdminShell>
  );
}
