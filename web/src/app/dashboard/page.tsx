"use client";

// Purpose: Redirect /dashboard to the role-specific dashboard.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { dashboardPath, useAuth } from "@/lib/auth";

export default function DashboardRedirectPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
      return;
    }
    router.replace(user.mustChangePassword ? "/change-password" : dashboardPath(user.role));
  }, [user, loading, router]);

  return (
    <main className="grid min-h-screen place-items-center text-muted">
      Opening your dashboard…
    </main>
  );
}
