"use client";

// Purpose: Platform SUPER_ADMIN dashboard — schools + platform stats.
import { useEffect, useState } from "react";
import Link from "next/link";
import { SuperAdminShell } from "@/components/SuperAdminShell";
import { Button, ErrorText } from "@/components/ui";
import { api, formatApiError } from "@/lib/api";

type Overview = {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalSchoolAdmins: number;
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ success: true; data: Overview }>("/api/platform/overview")
      .then((res) => setData(res.data))
      .catch((err) => setError(formatApiError(err, "Failed to load overview")));
  }, []);

  const cards = data
    ? [
        ["Total schools", data.totalSchools],
        ["Active schools", data.activeSchools],
        ["Suspended schools", data.suspendedSchools],
        ["Students (all)", data.totalStudents],
        ["Teachers (all)", data.totalTeachers],
        ["School admins", data.totalSchoolAdmins],
      ]
    : [];

  return (
    <SuperAdminShell title="Dashboard">
      <ErrorText>{error}</ErrorText>
      <div className="mb-6 flex flex-wrap gap-3">
        <Link href="/admin/schools">
          <Button type="button" className="bg-[#7ec8c8] text-[#0b1c24]">
            Manage schools
          </Button>
        </Link>
        <Link href="/admin/schools/new">
          <Button type="button" variant="secondary">
            Create school
          </Button>
        </Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-3xl border border-white/10 bg-[#122833] p-5"
          >
            <p className="text-sm text-white/60">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
              {value}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-white/55">
        Create a school, assign its school administrator, then activate or suspend tenants. School
        Admin / Teacher / Student portals stay isolated per school.
      </p>
    </SuperAdminShell>
  );
}
